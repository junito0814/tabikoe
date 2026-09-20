"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import type { ItineraryListItem } from "@/lib/itineraries/get-itinerary";
import { dayKeys, type DayKey } from "@/components/itineraries/DayTabs";
import { dayLabel } from "@/components/itineraries/DayMoveDropdown";
import { defaultItineraryApi, type ItineraryApi } from "@/components/itineraries/itinerary-api";
import { MAX_TRIP_TITLE_LENGTH } from "@/lib/trips/constants";

/**
 * wishlist-v3 Task1 / Task2: 保存先シート（行きたい＋しおり＋Day）
 * 出典: docs/tasks/records/wishlist-v3/01-save-sheet.md
 *       docs/tasks/records/wishlist-v3/02-wishlist-list-map-toggle.md
 *       要件定義書 v3.0 3.6.4・3.11.4
 *
 * 【初心者向け】1 枚のシートに 2 段。
 *   上段: 「行きたいスポット」（件数つき）。チェックで /api/wishlist を呼ぶ（showWishlist=false なら出さない＝ItineraryPickerSheet）
 *   下段: 自分のしおり一覧（GET /api/itineraries?spot=）。入っているものはチェック済み。
 *         チェックで /api/itineraries/[id]/spots を呼び、期間があれば Day の選択（既定は未定）を展開する
 *         「＋ 新しいしおりを作る」はタイトルだけで作り、そのままこのスポットを入れる
 * チェックの付け外しだけで保存・削除が確定する（「完了」は閉じるだけ）。閉じるときに保存したしおりを親へ知らせ、
 * 親がトースト「〈しおり名〉に保存しました [しおりを見る]」を出す。
 */
export interface SaveSheetApi {
  itineraries: ItineraryApi;
  wishlistCount: () => Promise<number>;
  toggleWishlist: (spotId: string, save: boolean) => Promise<Response>;
}

export interface SaveResult {
  /** 最後に保存したしおり（トースト用） */
  savedItinerary: { id: string; title: string } | null;
  wishlisted: boolean;
}

export function SaveSheet({
  open,
  spotId,
  spotName,
  initialWishlisted,
  showWishlist = true,
  onClose,
  api = defaultSaveSheetApi,
}: {
  open: boolean;
  spotId: string;
  spotName?: string;
  initialWishlisted: boolean;
  /** false なら「しおりと Day を選ぶシート」（行きたい画面の「＋」）になる */
  showWishlist?: boolean;
  onClose: (result: SaveResult) => void;
  api?: SaveSheetApi;
}) {
  if (!open) return null;
  return <SaveSheetBody spotId={spotId} spotName={spotName} initialWishlisted={initialWishlisted} showWishlist={showWishlist} onClose={onClose} api={api} />;
}

function SaveSheetBody({
  spotId,
  spotName,
  initialWishlisted,
  showWishlist,
  onClose,
  api,
}: {
  spotId: string;
  spotName?: string;
  initialWishlisted: boolean;
  showWishlist: boolean;
  onClose: (result: SaveResult) => void;
  api: SaveSheetApi;
}) {
  const [wishlisted, setWishlisted] = useState(initialWishlisted);
  const [wishlistCount, setWishlistCount] = useState<number | null>(null);
  const [items, setItems] = useState<ItineraryListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [savedItinerary, setSavedItinerary] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.itineraries
      .list(spotId)
      .then((data) => {
        if (!cancelled) setItems(data.items);
      })
      .catch((caught) => {
        if (cancelled || caught instanceof UnauthorizedError) return;
        setItems([]);
        setError("しおりを読み込めませんでした");
      });
    if (showWishlist) {
      api
        .wishlistCount()
        .then((count) => {
          if (!cancelled) setWishlistCount(count);
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [api, spotId, showWishlist]);

  const guard = async (work: () => Promise<void>, failure: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (caught) {
      if (caught instanceof UnauthorizedError) return;
      setError(failure);
    } finally {
      setBusy(false);
    }
  };

  const toggleWishlist = () =>
    guard(async () => {
      const next = !wishlisted;
      const response = await api.toggleWishlist(spotId, next);
      if (!response.ok) throw new Error("wishlist");
      setWishlisted(next);
      setWishlistCount((count) => (count === null ? count : count + (next ? 1 : -1)));
    }, "保存できませんでした");

  const toggleItinerary = (item: ItineraryListItem) =>
    guard(async () => {
      if (item.containsSpot) {
        const response = await api.itineraries.removeSpot(item.id, spotId);
        if (!response.ok) throw new Error("remove");
        setItems((current) => (current ?? []).map((it) => (it.id === item.id ? { ...it, containsSpot: false, spotDayIndex: null, spotCount: it.spotCount - 1 } : it)));
      } else {
        // 既定は「日付なし」（Day は後から選べる）
        const response = await api.itineraries.addSpot(item.id, spotId, null);
        if (!response.ok) throw new Error("add");
        setItems((current) => (current ?? []).map((it) => (it.id === item.id ? { ...it, containsSpot: true, spotDayIndex: null, spotCount: it.spotCount + 1 } : it)));
        setSavedItinerary({ id: item.id, title: item.title });
      }
    }, "しおりに保存できませんでした");

  const changeDay = (item: ItineraryListItem, day: DayKey) =>
    guard(async () => {
      const response = await api.itineraries.updateSpot(item.id, spotId, { dayIndex: day });
      if (!response.ok) throw new Error("day");
      setItems((current) => (current ?? []).map((it) => (it.id === item.id ? { ...it, spotDayIndex: day } : it)));
      setSavedItinerary({ id: item.id, title: item.title });
    }, "Day を変更できませんでした");

  const createItinerary = (event: FormEvent) => {
    event.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    void guard(async () => {
      const response = await api.itineraries.create({ title, startDate: null, endDate: null });
      if (response.status === 409) {
        setError("その旅行にはすでにしおりがあります。一覧から選んでください");
        return;
      }
      if (!response.ok) throw new Error("create");
      const data = (await response.json()) as { itineraryId: string };
      const added = await api.itineraries.addSpot(data.itineraryId, spotId, null);
      if (!added.ok) throw new Error("add");
      setItems((current) => [
        { id: data.itineraryId, tripId: "", title, startDate: null, endDate: null, dayCount: 0, spotCount: 1, checkedCount: 0, updatedAt: new Date().toISOString(), role: "owner", hasAlbumPosts: false, containsSpot: true, spotDayIndex: null },
        ...(current ?? []),
      ]);
      setSavedItinerary({ id: data.itineraryId, title });
      setNewTitle("");
      setIsCreating(false);
    }, "しおりを作成できませんでした");
  };

  const close = () => onClose({ savedItinerary, wishlisted });
  const title = showWishlist ? "保存先" : `${spotName ?? "このスポット"} をしおりへ`;

  return (
    <Sheet
      open
      title={title}
      onClose={close}
      footer={
        <button type="button" onClick={close} className="h-11 w-full rounded-[10px] bg-ink text-[14px] font-semibold text-on-ink">
          完了
        </button>
      }
    >
      <div className="flex flex-col gap-3" data-save-sheet>
        {showWishlist && (
          <label className="flex cursor-pointer items-center gap-3 rounded-[10px] border border-line px-3 py-2.5">
            <input type="checkbox" checked={wishlisted} onChange={() => void toggleWishlist()} disabled={busy} className="h-5 w-5 accent-[var(--accent)]" />
            <span className="flex-1 text-[14px] font-semibold text-ink">🔖 行きたいスポット</span>
            {wishlistCount !== null && <span className="text-[12px] text-muted">{wishlistCount} 件</span>}
          </label>
        )}

        <div>
          <h3 className="mb-1.5 text-[12px] font-semibold text-muted">しおり</h3>
          {items === null ? (
            <p className="py-3 text-[12px] text-muted">読み込んでいます…</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {items.map((item) => (
                <li key={item.id} className="rounded-[10px] border border-line px-3 py-2.5" data-save-itinerary={item.id}>
                  <label className="flex cursor-pointer items-center gap-3">
                    <input type="checkbox" checked={item.containsSpot === true} onChange={() => void toggleItinerary(item)} disabled={busy} className="h-5 w-5 accent-[var(--accent)]" />
                    <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">{item.title}</span>
                    <span className="shrink-0 text-[11px] text-muted">{item.spotCount} スポット</span>
                  </label>
                  {item.containsSpot && item.dayCount > 0 && (
                    <div role="radiogroup" aria-label={`${item.title} の Day`} className="mt-2 flex flex-wrap gap-1.5 pl-8">
                      {dayKeys(item.dayCount).map((day) => {
                        const selected = (item.spotDayIndex ?? null) === day;
                        return (
                          <button
                            key={day ?? "undecided"}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => !selected && void changeDay(item, day)}
                            disabled={busy}
                            className={`h-7 rounded-full px-2.5 text-[11px] font-semibold ${selected ? "bg-accent text-white" : "border border-line text-ink"}`}
                          >
                            {dayLabel(day)}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {isCreating ? (
            <form onSubmit={createItinerary} className="mt-2 flex gap-2">
              <input
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                maxLength={MAX_TRIP_TITLE_LENGTH}
                placeholder="アルバム名（例: 大阪旅行）"
                aria-label="アルバム名"
                autoFocus
                className="h-10 min-w-0 flex-1 rounded-[10px] border border-line bg-surface px-3 text-[13px] text-ink focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <button type="submit" disabled={busy || !newTitle.trim()} className="h-10 shrink-0 rounded-[10px] bg-accent px-3 text-[12px] font-semibold text-white disabled:opacity-45">
                作る
              </button>
            </form>
          ) : (
            <button type="button" onClick={() => setIsCreating(true)} className="mt-2 text-[13px] font-semibold text-accent">
              ＋ 新しいしおりを作る
            </button>
          )}
        </div>
        {error && <ErrorNotice message={error} />}
      </div>
    </Sheet>
  );
}

export const defaultSaveSheetApi: SaveSheetApi = {
  itineraries: defaultItineraryApi,
  wishlistCount: async () => {
    const response = await fetchWithAuthRedirect("/api/wishlist");
    if (!response.ok) return 0;
    const data = (await response.json()) as { items: unknown[] };
    return data.items.length;
  },
  toggleWishlist: (spotId, save) =>
    save
      ? fetchWithAuthRedirect("/api/wishlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ spotId }) })
      : fetchWithAuthRedirect(`/api/wishlist/${spotId}`, { method: "DELETE" }),
};
