"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { Toast, type ToastMessage } from "@/components/ui/Toast";
import { UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import { addSpotsHref } from "@/lib/itineraries/add-mode";
import { formatPeriodLabel } from "@/lib/itineraries/day-utils";
import type { ItineraryDetail, ItinerarySpotItem } from "@/lib/itineraries/get-itinerary";
import { can } from "@/lib/itineraries/membership";
import { orderSpots } from "@/lib/itineraries/order-spots";
import { MapSheetLayout } from "@/components/layout/MapSheetLayout";
import { ItineraryStaticMap } from "@/components/map/ItineraryStaticMap";
import { dayLabel } from "./DayMoveDropdown";
import { ALL_TAB, DayTabs, daysInTab, type DayKey, type DayTab } from "./DayTabs";
import { moveItem, useRowDrag } from "./use-row-drag";
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
 * 【初心者向け】上から順に（v3.1 mentoring-7 Task8 で簡略化）:
 *   1. ヘッダー（戻る・タイトル ✎（タップで名前変更）・「地図で見る」）と「⋯」（招待・メンバー・しおりを削除。オーナーのみ）
 *   2. 期間（年つき。タップでカレンダー）、スポット数・メンバー数、「アルバムを見る」（投稿があるとき）。値段は出さない
 *   3. Day タブ（左端が ALL、続いて Day 1〜n。「未定」タブは無く、日付なしは ALL にだけ出る）
 *   4. そのタブのスポット行（時刻順→手動順。ItinerarySpotRow）。ALL では Day ごとの見出しを挟む。時刻の無い行は取っ手 ≡ でドラッグ並べ替え
 *   5. 「＋ スポットを追加」（追加モードで投稿一覧へ。行き先は最多の都道府県）、右下「しおりを削除」
 * 「地図で見る」を押すと別画面へ飛ばず、上 1/3 に地図（ItineraryStaticMap）を出して下に一覧を残す（MapSheetLayout）。
 * サーバーから受け取った `initial` を state に持ち、操作のたびに API を呼んで `api.get` で取り直す（表示は常にサーバーの並び順）。
 * `?day=&spot=` で開かれたら（地図の番号ピンから）その Day を開き、該当行を強調する。
 */
/**
 * loading-feedback Task 3（2026-09-30）: いま処理中の操作
 * 出典: docs/tasks/shared-ui/loading-feedback/03-pending-feedback.md、要件定義書 4.5.11
 */
type PendingOp = { kind: "remove"; spotId: string } | { kind: "move"; spotId: string } | { kind: "rename" } | { kind: "delete" } | null;

/** 処理中に出す文言。要件 4.5.11 の「〜中…」で揃える */
const PENDING_LABELS: Record<NonNullable<PendingOp>["kind"], string> = {
  remove: "しおりから外しています…",
  move: "移動しています…",
  rename: "名前を変えています…",
  delete: "しおりを削除しています…",
};

export function ItineraryDetailScreen({
  initial,
  viewerId,
  initialDay = ALL_TAB,
  highlightSpotId = null,
  api = defaultItineraryApi,
  back = null,
}: {
  /** Bug #471: 直前の画面（`?back=` から page.tsx が解決）。無ければ既定の戻り先 */
  back?: { href: string; label: string } | null;
  initial: ItineraryDetail;
  viewerId: string;
  /** 最初に開くタブ（既定は ALL。地図の番号ピンからはその Day） */
  initialDay?: DayTab;
  highlightSpotId?: string | null;
  api?: ItineraryApi;
}) {
  const router = useRouter();
  const [itinerary, setItinerary] = useState<ItineraryDetail>(initial);
  const [day, setDay] = useState<DayTab>(initialDay);
  const [showMap, setShowMap] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"period" | "invite" | "members" | "rename" | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  /**
   * loading-feedback Task 3（2026-09-30）: いま何をしている最中か。
   * 【初心者向け】この画面は押してから API と再取得の 2 往復が終わるまで何も変わらず、
   * 押せていないのか処理中なのか分からなかった（要件 4.5.11 の場面 3）。
   * 「どの操作か」を持ち、文言を出しつつ二重に押せないようにする。
   * 時刻・メモ・チェックはここに含めない（押した瞬間に画面が変わる楽観更新のため）。
   */
  const [pending, setPending] = useState<PendingOp>(null);
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

  const run = async (request: () => Promise<Response>, failure: string, op: PendingOp = null): Promise<boolean> => {
    setError(null);
    if (op) setPending(op);
    try {
      const response = await request();
      if (!response.ok) {
        setError(response.status === 403 ? "この操作はオーナーだけができます" : failure);
        return false;
      }
      // 再取得が終わるまで処理中のままにする（2 往復目で無反応に戻らないように）
      await reload();
      return true;
    } catch (caught) {
      if (caught instanceof UnauthorizedError) return false;
      setError(failure);
      return false;
    } finally {
      if (op) setPending(null);
    }
  };

  // ── スポット行の操作 ──
  // 表示する行を Day ごとにまとめる（ALL なら Day 1 → … → 日付なし の順。各 Day の中は時刻順→手動順）
  const groups: { day: DayKey; spots: ItinerarySpotItem[] }[] = daysInTab(day, itinerary.dayCount)
    .map((key) => ({ day: key, spots: orderSpots(itinerary.spots.filter((spot) => spot.dayIndex === key)) }))
    .filter((group) => day === ALL_TAB ? group.spots.length > 0 : true);
  const visibleCount = groups.reduce((sum, group) => sum + group.spots.length, 0);

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

  /**
   * v3.1: ドラッグで時刻の無い行を並べ替える。同じ Day の時刻の無い行の並び（手動順）の中で from → to に動かし、
   * 並び直した順に sort_order を 0,1,2… と振り直す（変わった行だけ API を呼ぶ）。時刻のある行は動かさない。
   */
  const reorderUntimed = async (dayKey: DayKey, from: number, to: number) => {
    const untimed = orderSpots(itinerary.spots.filter((spot) => spot.dayIndex === dayKey)).filter((spot) => spot.arrivalTime === null);
    if (from === to || !untimed[from] || !untimed[to]) return;
    const next = moveItem(untimed, from, to);
    // 楽観的に反映（sortOrder を振り直す）
    const orders = new Map(next.map((spot, index) => [spot.spotId, index]));
    setItinerary((current) => ({ ...current, spots: current.spots.map((spot) => (orders.has(spot.spotId) ? { ...spot, sortOrder: orders.get(spot.spotId) as number } : spot)) }));
    setError(null);
    try {
      const results = await Promise.all(next.flatMap((spot, index) => (spot.sortOrder === index ? [] : [api.updateSpot(itinerary.id, spot.spotId, { sortOrder: index })])));
      if (results.some((response) => !response.ok)) setError("並び替えできませんでした");
    } catch (caught) {
      if (caught instanceof UnauthorizedError) return;
      setError("並び替えできませんでした");
    }
    await reload();
  };

  const removeSpot = async (spotId: string) => {
    const spot = itinerary.spots.find((item) => item.spotId === spotId);
    if (!spot || !window.confirm(`「${spot.name}」をしおりから外しますか？（投稿と行きたいはそのままです）`)) return;
    await run(() => api.removeSpot(itinerary.id, spotId), "外せませんでした", { kind: "remove", spotId });
  };

  const moveDay = async (spotId: string, target: DayKey) => {
    const ok = await run(() => api.updateSpot(itinerary.id, spotId, { dayIndex: target }), "移動できませんでした", { kind: "move", spotId });
    if (ok) setToast({ text: `${dayLabel(target)} に移動しました`, action: { label: `${dayLabel(target)} を見る`, onClick: () => setDay(target ?? ALL_TAB) } });
  };

  const deleteItinerary = async () => {
    if (!window.confirm("このしおりを削除しますか？\n同じ旅行のアルバム（投稿）は残ります。")) return;
    setPending({ kind: "delete" });
    try {
      const response = await api.remove(itinerary.id);
      if (!response.ok) {
        setError("削除できませんでした");
        setPending(null);
        return;
      }
      // 画面ごと移るので、ここでは処理中のままにしておく（一覧に着くまで押せないように）
      router.push("/itineraries");
      router.refresh();
    } catch (caught) {
      if (!(caught instanceof UnauthorizedError)) setError("削除できませんでした");
      setPending(null);
    }
  };

  const rename = async () => {
    const next = window.prompt("アルバム名", itinerary.title);
    if (next === null || next.trim() === itinerary.title) return;
    await run(() => api.rename(itinerary.id, next.trim()), "タイトルを変更できませんでした", { kind: "rename" });
  };

  const periodLabel = formatPeriodLabel(itinerary.startDate, itinerary.endDate);
  const canEdit = can(itinerary.role, "change_period");

  const content = (
    <div className="flex flex-col items-center px-4 pt-4 pb-24" data-itinerary-detail data-day-tab={String(day)}>
      <div className="w-full max-w-[520px]">
        <header className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <Link href={back?.href ?? "/itineraries"} className="inline-flex h-8 shrink-0 items-center gap-1 text-[12px] font-medium text-muted">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {back?.label ?? "計画"}
            </Link>
            {/* v3.1: タイトルをタップ（✎）で名前を変更。「名前を変更」ボタンは置かない */}
            {isOwner ? (
              <button type="button" onClick={() => void rename()} aria-label={`${itinerary.title}（名前を変更）`} className="min-w-0 flex-1 truncate text-center text-[16px] font-bold text-ink">
                {itinerary.title} <span aria-hidden className="text-[12px] font-normal text-muted">✎</span>
              </button>
            ) : (
              <h1 className="min-w-0 flex-1 truncate text-center text-[16px] font-bold text-ink">{itinerary.title}</h1>
            )}
            <button
              type="button"
              onClick={() => setShowMap((current) => !current)}
              aria-pressed={showMap}
              className={`inline-flex h-8 shrink-0 items-center gap-1 rounded-full border px-3 text-[12px] font-semibold ${showMap ? "border-accent bg-accent text-white" : "border-line bg-surface text-ink"}`}
            >
              🗺 {showMap ? "地図を閉じる" : "地図で見る"}
            </button>
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

          {/* v3.1: 期間は年つき。表示そのものをタップするとカレンダー（オーナーのみ）。「期間を変更」ボタンは置かない */}
          {canEdit ? (
            <button type="button" onClick={() => setDialog("period")} aria-label={itinerary.startDate ? `期間 ${periodLabel}（変更）` : "期間を設定"} className="flex w-fit items-center gap-1 text-[12px] text-ink" data-period>
              📅 {itinerary.startDate ? periodLabel : "期間を設定"} <span aria-hidden className="text-muted">✎</span>
            </button>
          ) : (
            <p className="text-[12px] text-ink" data-period>
              📅 {periodLabel}
            </p>
          )}
          <p className="text-[12px] text-muted">
            {itinerary.spots.length} スポット
            {itinerary.members.length > 1 && ` ・ メンバー ${itinerary.members.length} 人`}
          </p>
          {itinerary.albumPostCount > 0 && (
            <Link href={`/albums/${itinerary.tripId}?back=${encodeURIComponent(`/itineraries/${itinerary.id}`)}`} className="inline-flex h-8 w-fit items-center gap-1 rounded-full border border-line bg-surface px-3 text-[12px] font-semibold text-ink">
              📷 アルバム「{itinerary.title}」を見る（{itinerary.albumPostCount}）
            </Link>
          )}
        </header>

        <DayTabs dayCount={itinerary.dayCount} dayDates={itinerary.dayDates} spots={itinerary.spots} value={day} onChange={setDay} className="mt-3" />

        {/* loading-feedback Task 3: 押した直後に必ず画面が変わるようにする（要件 4.5.11） */}
        {pending && (
          <p role="status" className="mt-2 rounded-[10px] border border-line bg-surface px-3 py-2 text-[12px] text-muted">
            {PENDING_LABELS[pending.kind]}
          </p>
        )}
        {error && <ErrorNotice className="mt-2" message={error} />}

        {visibleCount === 0 ? (
          <p className="py-12 text-center text-[13px] text-muted">{day === ALL_TAB ? "スポットはまだありません" : "この日のスポットはまだありません"}</p>
        ) : (
          groups.map((group) => (
            <DayGroup
              key={String(group.day)}
              day={group.day}
              spots={group.spots}
              showHeading={day === ALL_TAB && itinerary.dayCount > 0}
              itineraryId={itinerary.id}
              dayCount={itinerary.dayCount}
              highlightSpotId={highlightSpotId}
              onUpdate={updateSpot}
              onRemove={(spotId) => void removeSpot(spotId)}
              onMoveDay={(spotId, target) => void moveDay(spotId, target)}
              pending={pending && "spotId" in pending ? pending : null}
              onReorder={(from, to) => void reorderUntimed(group.day, from, to)}
            />
          ))
        )}

        <div className="mt-4 flex items-center justify-between">
          <Link
            href={addSpotsHref(
              itinerary.id,
              // ALL タブから追加するときは日付なしへ
              day === ALL_TAB ? null : day,
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
            if (day !== ALL_TAB && (data.dayCount ?? 0) < day) setDay(ALL_TAB);
            if (data.movedToUndecided) setToast({ text: `${data.movedToUndecided} 件のスポットを日付なしに移しました`, action: { label: "ALL を見る", onClick: () => setDay(ALL_TAB) } });
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

  // v3.1: 「地図で見る」中は上 1/3 に地図（開いている Day の番号ピン）、下 2/3 に一覧。押していなければ一覧だけ
  // map-sheet Task2: 地図を広くした段階でシートに出す 1 行（4.5.6）。しおり名・Day
  const mapSummary = (
    <p className="flex items-center gap-x-2 px-4 pb-3 text-[13px] font-semibold text-ink" data-sheet-summary-line>
      <span className="truncate">{itinerary.title}</span>
      <span className="shrink-0 font-normal text-muted">{day === "all" ? "ALL" : `Day ${day}`}</span>
    </p>
  );

  return showMap ? (
    <MapSheetLayout map={<ItineraryStaticMap itinerary={itinerary} day={day} className="h-full w-full" />} summary={mapSummary}>
      {content}
    </MapSheetLayout>
  ) : (
    <div className="min-h-screen bg-app">{content}</div>
  );
}

/**
 * 1 つの Day の行の並び（ALL では Day ごとの見出しを付ける）。ドラッグ並べ替え（useRowDrag）は Day ごとに独立させる。
 * 【初心者向け】並べ替えの対象は「時刻の無い行」だけなので、取っ手のインデックスは時刻の無い行の中での順番（untimedIndex）で数える。
 */
function DayGroup({
  day,
  spots,
  showHeading,
  itineraryId,
  dayCount,
  highlightSpotId,
  onUpdate,
  onRemove,
  onMoveDay,
  onReorder,
  pending,
}: {
  day: DayKey;
  spots: ItinerarySpotItem[];
  showHeading: boolean;
  itineraryId: string;
  dayCount: number;
  highlightSpotId: string | null;
  onUpdate: (spotId: string, patch: { arrivalTime?: string | null; memo?: string | null; checked?: boolean }) => Promise<void>;
  onRemove: (spotId: string) => void;
  onMoveDay: (spotId: string, target: DayKey) => void;
  onReorder: (from: number, to: number) => void;
  /** loading-feedback Task 3: 処理中の行と、その操作の種類 */
  pending: { kind: "remove" | "move"; spotId: string } | null;
}) {
  const { dragging, registerRow, handleProps } = useRowDrag(onReorder);
  // 時刻の無い行の中での順番（取っ手のインデックス）。時刻のある行は -1
  const positions = spots.reduce<number[]>((acc, spot) => {
    const previous = acc.length > 0 ? Math.max(...acc) : -1;
    acc.push(spot.arrivalTime === null ? previous + 1 : -1);
    return acc;
  }, []);
  return (
    <section aria-label={dayLabel(day)} data-day-group={String(day ?? "none")} className="mt-2">
      {showHeading && <h2 className="mb-1.5 text-[12px] font-bold text-muted">{dayLabel(day)}</h2>}
      <ul className="flex flex-col gap-2">
        {spots.map((spot, index) => {
          const untimed = spot.arrivalTime === null;
          const position = positions[index];
          return (
            <ItinerarySpotRow
              key={spot.id}
              spot={spot}
              index={index + 1}
              itineraryId={itineraryId}
              dayCount={dayCount}
              highlighted={spot.spotId === highlightSpotId}
              dragHandleProps={untimed ? handleProps(position) : null}
              rowRef={untimed ? registerRow(position) : undefined}
              isDragging={dragging?.from === position && untimed}
              isDropTarget={dragging !== null && dragging.over === position && dragging.from !== position && untimed}
              onUpdate={onUpdate}
              onRemove={onRemove}
              onMoveDay={onMoveDay}
              pending={pending?.spotId === spot.spotId ? pending.kind : null}
            />
          );
        })}
      </ul>
    </section>
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
