"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { Toast, type ToastMessage } from "@/components/ui/Toast";
import { UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import { addSpotsHref } from "@/lib/itineraries/add-mode";
import { formatDayLabel } from "@/lib/itineraries/day-utils";
import type { ItineraryDetail } from "@/lib/itineraries/get-itinerary";
import { can } from "@/lib/itineraries/membership";
import { orderSpots } from "@/lib/itineraries/order-spots";
import { formatCost } from "@/components/posts/PostCard";
import { dayLabel } from "./DayMoveDropdown";
import { DayTabs, type DayKey } from "./DayTabs";
import { InviteDialog } from "./InviteDialog";
import { ItinerarySpotRow } from "./ItinerarySpotRow";
import { MembersDialog } from "./MembersDialog";
import { PeriodDialog } from "./PeriodDialog";
import { defaultItineraryApi, type ItineraryApi } from "./itinerary-api";

/**
 * itinerary-basics Task3 / itinerary-days Task2 / arrival-time Task3 / itinerary-check Task3: しおり詳細（SC-23）
 * 出典: docs/tasks/itinerary/itinerary-basics/03-itinerary-detail-skeleton.md
 *       docs/tasks/itinerary/itinerary-days/02-day-tabs-and-move-ui.md
 *       docs/tasks/itinerary/arrival-time/03-spot-row-ui.md
 *       docs/tasks/itinerary/itinerary-check/03-row-display-and-map-pins.md
 *       要件定義書 v3.0 3.11
 *
 * 【初心者向け】上から順に:
 *   1. ヘッダー（戻る・旅行タイトル・「地図で見る」）と「⋯」（招待・メンバー・しおりを削除。オーナーのみ）
 *   2. 期間行（「期間を変更」／未設定なら「期間を設定」）、スポット数・予算目安、「アルバムを見る」（投稿があるとき）
 *   3. Day タブ（日数＋未定）
 *   4. その Day のスポット行（時刻順→手動順。ItinerarySpotRow）
 *   5. 「＋ スポットを追加」（追加モードで投稿一覧へ。行き先は最多の都道府県）、右下「しおりを削除」
 * サーバーから受け取った `initial` を state に持ち、操作のたびに API を呼んで `api.get` で取り直す（表示は常にサーバーの並び順）。
 * `?day=&spot=` で開かれたら（地図の番号ピンから）その Day を開き、該当行を強調する。
 */
export function ItineraryDetailScreen({
  initial,
  viewerId,
  initialDay,
  highlightSpotId = null,
  api = defaultItineraryApi,
}: {
  initial: ItineraryDetail;
  viewerId: string;
  /** 最初に開く Day（undefined なら Day 1、期間が無ければ未定） */
  initialDay?: DayKey;
  highlightSpotId?: string | null;
  api?: ItineraryApi;
}) {
  const router = useRouter();
  const [itinerary, setItinerary] = useState<ItineraryDetail>(initial);
  const [day, setDay] = useState<DayKey>(initialDay === undefined ? (initial.dayCount > 0 ? 1 : null) : initialDay);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"period" | "invite" | "members" | "rename" | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isOwner = itinerary.role === "owner";

  useEffect(() => {
    if (!isMenuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setIsMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [isMenuOpen]);

  // 操作後にサーバーから取り直す（並び順・件数・投稿済みをサーバーの判断に揃える）
  const reload = useCallback(async () => {
    try {
      const data = await api.get(itinerary.id);
      setItinerary(data.itinerary);
    } catch (caught) {
      if (caught instanceof UnauthorizedError) return;
      setError("最新の状態を取得できませんでした");
    }
  }, [api, itinerary.id]);

  const run = async (request: () => Promise<Response>, failure: string): Promise<boolean> => {
    setError(null);
    try {
      const response = await request();
      if (!response.ok) {
        setError(response.status === 403 ? "この操作はオーナーだけができます" : failure);
        return false;
      }
      await reload();
      return true;
    } catch (caught) {
      if (caught instanceof UnauthorizedError) return false;
      setError(failure);
      return false;
    }
  };

  // ── スポット行の操作 ──
  const spotsInDay = orderSpots(itinerary.spots.filter((spot) => spot.dayIndex === day));

  const updateSpot = async (spotId: string, patch: { arrivalTime?: string | null; memo?: string | null; checked?: boolean }) => {
    // チェックと時刻は楽観的に反映（並び順の再計算は reload に任せる）
    setItinerary((current) => ({
      ...current,
      spots: current.spots.map((spot) =>
        spot.spotId === spotId
          ? {
              ...spot,
              ...(patch.arrivalTime !== undefined ? { arrivalTime: patch.arrivalTime } : {}),
              ...(patch.memo !== undefined ? { memo: patch.memo } : {}),
              ...(patch.checked !== undefined ? { checkedAt: patch.checked ? new Date().toISOString() : null, checkedBy: patch.checked ? viewerId : null } : {}),
            }
          : spot
      ),
    }));
    await run(() => api.updateSpot(itinerary.id, spotId, patch), patch.memo !== undefined ? "メモを保存できませんでした（500 文字まで）" : "保存できませんでした");
  };

  const moveSpot = async (spotId: string, direction: "up" | "down") => {
    // 時刻の無い行だけを手動順で入れ替える。sort_order を隣と交換する
    const untimed = spotsInDay.filter((spot) => spot.arrivalTime === null);
    const index = untimed.findIndex((spot) => spot.spotId === spotId);
    const swapWith = untimed[direction === "up" ? index - 1 : index + 1];
    if (index < 0 || !swapWith) return;
    const me = untimed[index];
    const [a, b] = me.sortOrder === swapWith.sortOrder ? [me.sortOrder + 1, me.sortOrder] : [swapWith.sortOrder, me.sortOrder];
    setError(null);
    try {
      const first = await api.updateSpot(itinerary.id, me.spotId, { sortOrder: a });
      const second = await api.updateSpot(itinerary.id, swapWith.spotId, { sortOrder: b });
      if (!first.ok || !second.ok) setError("並び替えできませんでした");
    } catch (caught) {
      if (caught instanceof UnauthorizedError) return;
      setError("並び替えできませんでした");
    }
    await reload();
  };

  const removeSpot = async (spotId: string) => {
    const spot = itinerary.spots.find((item) => item.spotId === spotId);
    if (!spot || !window.confirm(`「${spot.name}」をしおりから外しますか？（投稿と行きたいはそのままです）`)) return;
    await run(() => api.removeSpot(itinerary.id, spotId), "外せませんでした");
  };

  const moveDay = async (spotId: string, target: DayKey) => {
    const ok = await run(() => api.updateSpot(itinerary.id, spotId, { dayIndex: target }), "移動できませんでした");
    if (ok) setToast({ text: `${dayLabel(target)} に移動しました`, action: { label: `${dayLabel(target)} を見る`, onClick: () => setDay(target) } });
  };

  const deleteItinerary = async () => {
    if (!window.confirm("このしおりを削除しますか？\n同じ旅行のアルバム（投稿）は残ります。")) return;
    const response = await api.remove(itinerary.id);
    if (!response.ok) {
      setError("削除できませんでした");
      return;
    }
    router.push("/itineraries");
    router.refresh();
  };

  const rename = async () => {
    const next = window.prompt("アルバム名", itinerary.title);
    if (next === null || next.trim() === itinerary.title) return;
    await run(() => api.rename(itinerary.id, next.trim()), "タイトルを変更できませんでした");
  };

  const periodLabel =
    itinerary.startDate && itinerary.endDate ? `${formatDayLabel(itinerary.startDate)} 〜 ${formatDayLabel(itinerary.endDate)}` : "期間未設定";
  const budget = formatCost(itinerary.budgetEstimate);
  const mapHref = `/map?itinerary=${itinerary.id}${day !== null ? `&day=${day}` : ""}`;

  return (
    <div className="flex min-h-screen flex-col items-center bg-app px-4 pt-4 pb-24" data-itinerary-detail>
      <div className="w-full max-w-[520px]">
        <header className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <Link href="/itineraries" className="inline-flex h-8 shrink-0 items-center gap-1 text-[12px] font-medium text-muted">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              しおり
            </Link>
            <h1 className="min-w-0 flex-1 truncate text-center text-[16px] font-bold text-ink">{itinerary.title}</h1>
            <Link href={mapHref} className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-line bg-surface px-3 text-[12px] font-semibold text-ink">
              🗺 地図で見る
            </Link>
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setIsMenuOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={isMenuOpen}
                aria-label="その他"
                className="h-8 w-8 rounded-full border border-line bg-surface text-[14px] font-bold text-ink"
              >
                ⋯
              </button>
              {isMenuOpen && (
                <ul role="menu" className="absolute right-0 z-20 mt-1 min-w-[150px] overflow-hidden rounded-[10px] border border-line bg-surface py-1 shadow-card">
                  {isOwner && (
                    <MenuItem
                      label="招待"
                      onClick={() => {
                        setIsMenuOpen(false);
                        setDialog("invite");
                      }}
                    />
                  )}
                  <MenuItem
                    label="メンバー"
                    onClick={() => {
                      setIsMenuOpen(false);
                      setDialog("members");
                    }}
                  />
                  {isOwner && (
                    <MenuItem
                      label="名前を変更"
                      onClick={() => {
                        setIsMenuOpen(false);
                        void rename();
                      }}
                    />
                  )}
                  {isOwner && (
                    <MenuItem
                      label="しおりを削除"
                      danger
                      onClick={() => {
                        setIsMenuOpen(false);
                        void deleteItinerary();
                      }}
                    />
                  )}
                </ul>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ink">
            <span>📅 {periodLabel}</span>
            {can(itinerary.role, "change_period") && (
              <button type="button" onClick={() => setDialog("period")} className="rounded-full border border-line bg-surface px-2.5 py-0.5 text-[11px] font-semibold">
                {itinerary.startDate ? "期間を変更" : "期間を設定"}
              </button>
            )}
          </div>
          <p className="text-[12px] text-muted">
            {itinerary.spots.length} スポット
            {budget && ` ・ 予算目安 ${budget}`}
            {itinerary.members.length > 1 && ` ・ メンバー ${itinerary.members.length} 人`}
          </p>
          {itinerary.albumPostCount > 0 && (
            <Link href={`/albums/${itinerary.tripId}`} className="inline-flex h-8 w-fit items-center gap-1 rounded-full border border-line bg-surface px-3 text-[12px] font-semibold text-ink">
              📷 アルバム「{itinerary.title}」を見る（{itinerary.albumPostCount}）
            </Link>
          )}
        </header>

        <DayTabs dayCount={itinerary.dayCount} dayDates={itinerary.dayDates} spots={itinerary.spots} value={day} onChange={setDay} className="mt-3" />

        {error && <ErrorNotice className="mt-2" message={error} />}

        {spotsInDay.length === 0 ? (
          <p className="py-12 text-center text-[13px] text-muted">{day === null ? "日付なしのスポットはありません" : "この日のスポットはまだありません"}</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {spotsInDay.map((spot, index) => {
              const untimed = spotsInDay.filter((item) => item.arrivalTime === null);
              const position = untimed.findIndex((item) => item.spotId === spot.spotId);
              return (
                <ItinerarySpotRow
                  key={spot.id}
                  spot={spot}
                  index={index + 1}
                  itineraryId={itinerary.id}
                  dayCount={itinerary.dayCount}
                  canMoveUp={position > 0}
                  canMoveDown={position >= 0 && position < untimed.length - 1}
                  highlighted={spot.spotId === highlightSpotId}
                  onUpdate={updateSpot}
                  onMove={(spotId, direction) => void moveSpot(spotId, direction)}
                  onRemove={(spotId) => void removeSpot(spotId)}
                  onMoveDay={(spotId, target) => void moveDay(spotId, target)}
                />
              );
            })}
          </ul>
        )}

        <div className="mt-4 flex items-center justify-between">
          <Link
            href={addSpotsHref(
              itinerary.id,
              day,
              itinerary.spots.map((spot) => spot.prefecture)
            )}
            className="inline-flex h-11 items-center gap-1.5 rounded-full bg-accent px-5 text-[13px] font-bold text-white"
          >
            ＋ スポットを追加
          </Link>
          {isOwner && (
            <button type="button" onClick={() => void deleteItinerary()} className="text-[12px] font-medium text-saved underline underline-offset-2">
              しおりを削除
            </button>
          )}
        </div>
      </div>

      <PeriodDialog
        key={`${itinerary.startDate}-${itinerary.endDate}-${dialog === "period" ? "open" : "closed"}`}
        open={dialog === "period"}
        startDate={itinerary.startDate}
        endDate={itinerary.endDate}
        onClose={() => setDialog(null)}
        onSubmit={async (startDate, endDate) => {
          const response = await api.updatePeriod(itinerary.id, startDate, endDate);
          if (response.ok) {
            const data = (await response.json()) as { movedToUndecided?: number; dayCount?: number };
            await reload();
            if (day !== null && (data.dayCount ?? 0) < day) setDay(null);
            if (data.movedToUndecided) setToast({ text: `${data.movedToUndecided} 件のスポットを日付なしに移しました`, action: { label: "未定を見る", onClick: () => setDay(null) } });
          }
          return response;
        }}
      />
      <InviteDialog open={dialog === "invite"} itineraryId={itinerary.id} onClose={() => setDialog(null)} api={api} />
      <MembersDialog
        key={itinerary.members.map((member) => member.userId).join(",")}
        open={dialog === "members"}
        itineraryId={itinerary.id}
        members={itinerary.members}
        viewerId={viewerId}
        role={itinerary.role}
        onClose={() => setDialog(null)}
        api={api}
      />
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

function MenuItem({ label, onClick, danger = false }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <li role="presentation">
      <button type="button" role="menuitem" onClick={onClick} className={`flex w-full px-3 py-2 text-left text-[13px] hover:bg-tint ${danger ? "text-saved" : "text-ink"}`}>
        {label}
      </button>
    </li>
  );
}
