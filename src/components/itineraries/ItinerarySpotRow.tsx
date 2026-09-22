"use client";

import { useState } from "react";
import Link from "next/link";
import { TimePicker10 } from "@/components/ui/TimePicker10";
import type { ItinerarySpotItem } from "@/lib/itineraries/get-itinerary";
import { composeHref } from "@/lib/posts/compose-initial-state";
import { DayMoveDropdown } from "./DayMoveDropdown";
import type { DayKey } from "./DayTabs";

/** メモの上限（書記素）。API と同じ値 */
export const MEMO_MAX_LENGTH = 500;

/**
 * arrival-time Task3 / itinerary-check Task3 / itinerary-map-and-post Task2: しおりのスポット 1 行
 * 出典: docs/tasks/itinerary/arrival-time/03-spot-row-ui.md
 *       docs/tasks/itinerary/itinerary-check/03-row-display-and-map-pins.md
 *       docs/tasks/itinerary/itinerary-map-and-post/02-post-links.md
 *
 * 【初心者向け】左の列は「時刻／その下にチェック」、右の列は「番号＋スポット名・メモ・導線」。
 *   - 時刻（TimePicker10）を押すと 10 分刻みのピッカー。時刻のある行は自動で時刻順に並ぶので上下ボタンは無効
 *   - チェック: 済みはスポット名に取り消し線＋薄字。位置は動かさない。確認は出さない
 *   - メモ: インライン編集（blur で保存）
 *   - 「投稿一覧」→ /spots/[id]、「投稿する」→ /posts/new?itinerary=&spot=、投稿済みなら「投稿済み ✓」
 *   - 「Day n ▾」で移動、取っ手「≡」のドラッグで手動順（時刻の無い行のみ。v3.1。use-row-drag.ts）、「削除」
 *   - 値段（費用の平均）は出さない（v3.1）
 * 保存はすべて親の `onUpdate`（API 呼び出し）に任せ、この行は表示と入力だけを持つ。
 */
export function ItinerarySpotRow({
  spot,
  index,
  itineraryId,
  dayCount,
  highlighted = false,
  dragHandleProps = null,
  isDragging = false,
  isDropTarget = false,
  rowRef,
  onUpdate,
  onRemove,
  onMoveDay,
}: {
  spot: ItinerarySpotItem;
  /** その Day の中での番号（1 始まり） */
  index: number;
  itineraryId: string;
  dayCount: number;
  /** 地図の番号ピンから来たときの強調 */
  highlighted?: boolean;
  /** v3.1: 取っ手 ≡ に付けるイベント（時刻の無い行だけ渡す。null なら取っ手を出さない） */
  dragHandleProps?: Record<string, unknown> | null;
  isDragging?: boolean;
  isDropTarget?: boolean;
  rowRef?: (element: HTMLLIElement | null) => void;
  onUpdate: (spotId: string, patch: { arrivalTime?: string | null; memo?: string | null; checked?: boolean }) => Promise<void>;
  onRemove: (spotId: string) => void;
  onMoveDay: (spotId: string, day: DayKey) => void;
}) {
  const [isPickingTime, setIsPickingTime] = useState(false);
  const [memo, setMemo] = useState(spot.memo ?? "");
  const [isEditingMemo, setIsEditingMemo] = useState(false);
  const checked = spot.checkedAt !== null;
  const hasTime = spot.arrivalTime !== null;

  const saveMemo = () => {
    setIsEditingMemo(false);
    const next = memo.trim();
    if ((spot.memo ?? "") === next) return;
    void onUpdate(spot.spotId, { memo: next.length > 0 ? next : null });
  };

  return (
    <li
      ref={rowRef}
      data-itinerary-spot={spot.spotId}
      data-checked={checked ? "true" : "false"}
      className={`flex gap-3 rounded-[12px] border bg-surface p-3 shadow-card ${highlighted ? "border-accent ring-1 ring-accent" : "border-line"} ${
        isDragging ? "opacity-60" : ""
      } ${isDropTarget ? "border-accent" : ""}`}
    >
      {/* 左の列: 時刻／チェック */}
      <div className="flex w-14 shrink-0 flex-col items-center gap-2">
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsPickingTime((open) => !open)}
            aria-label={hasTime ? `到着予定時刻 ${spot.arrivalTime}（変更）` : "到着予定時刻を設定"}
            className={`h-8 min-w-[52px] rounded-[8px] border px-1 text-[13px] font-bold ${hasTime ? "border-line text-ink" : "border-dashed border-line text-muted"}`}
          >
            {hasTime ? spot.arrivalTime : "──"}
          </button>
          {isPickingTime && (
            <div className="absolute left-0 top-full z-20 mt-1">
              <TimePicker10
                value={spot.arrivalTime}
                onChange={(next) => void onUpdate(spot.spotId, { arrivalTime: next })}
                onClose={() => setIsPickingTime(false)}
              />
            </div>
          )}
        </div>
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => void onUpdate(spot.spotId, { checked: event.target.checked })}
          aria-label={`${spot.name} を行った場所にする`}
          className="h-5 w-5 accent-[var(--done)]"
        />
      </div>

      {/* 右の列 */}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <p className={`min-w-0 text-[14px] font-bold ${checked ? "text-muted line-through" : "text-ink"}`} data-spot-name>
            <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-ink text-[11px] text-on-ink no-underline">{index}</span>
            {spot.name}
            {spot.isManualSpot && <span className="ml-1.5 rounded-full bg-tint px-1.5 py-0.5 text-[10px] font-semibold text-accent no-underline">タビコエだけの場所</span>}
          </p>
          <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted">
            {spot.ratingAverage !== null && (
              <span>
                <span className="text-star" aria-hidden>
                  ★
                </span>
                {spot.ratingAverage}
              </span>
            )}
          </span>
        </div>

        {isEditingMemo ? (
          <textarea
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
            onBlur={saveMemo}
            maxLength={MEMO_MAX_LENGTH * 2}
            rows={2}
            autoFocus
            aria-label="メモ"
            className="w-full rounded-[8px] border border-line bg-surface px-2 py-1 text-[12px] text-ink focus:outline-none focus:ring-1 focus:ring-accent"
          />
        ) : (
          <button type="button" onClick={() => setIsEditingMemo(true)} className="text-left text-[12px] text-muted">
            {spot.memo ? `メモ: ${spot.memo}` : "＋ メモを追加"}
          </button>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          {/* Bug #471: 「← しおり」で戻れるように、このしおりの URL を back= で渡す */}
          <Link href={`/spots/${spot.spotId}?back=${encodeURIComponent(`/itineraries/${itineraryId}`)}`} prefetch={false} className="inline-flex h-7 items-center rounded-full border border-line bg-surface px-2.5 text-[11px] font-semibold text-ink">
            投稿一覧
          </Link>
          {spot.hasPosted ? (
            <span className="inline-flex h-7 items-center rounded-full bg-done/10 px-2.5 text-[11px] font-semibold text-done">投稿済み ✓</span>
          ) : (
            <Link
              href={composeHref({ kind: "itinerary", itineraryId, spotId: spot.spotId, dayIndex: spot.dayIndex })}
              className={`inline-flex h-7 items-center rounded-full px-2.5 text-[11px] font-bold ${checked ? "bg-accent text-white" : "border border-accent text-accent"}`}
            >
              投稿する
            </Link>
          )}
          <span className="ml-auto flex items-center gap-1">
            <DayMoveDropdown value={spot.dayIndex} dayCount={dayCount} onChange={(day) => onMoveDay(spot.spotId, day)} />
            <button type="button" onClick={() => onRemove(spot.spotId)} className="h-7 rounded-full px-2 text-[11px] font-medium text-saved">
              削除
            </button>
            {/* v3.1: 時刻の無い行だけ取っ手 ≡（ドラッグで並べ替え。↑↓ キーでも動く） */}
            {!hasTime && dragHandleProps && (
              <button
                type="button"
                {...dragHandleProps}
                aria-label={`${spot.name} を並べ替え`}
                data-drag-handle
                className="h-7 w-7 cursor-grab touch-none rounded-full border border-line text-[13px] text-muted active:cursor-grabbing"
              >
                ≡
              </button>
            )}
          </span>
        </div>
      </div>
    </li>
  );
}
