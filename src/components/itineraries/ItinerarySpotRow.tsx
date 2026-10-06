"use client";

import { useEffect, useRef, useState } from "react";
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
 * #753（2026-10-06）: 行の形を直した（決定事項 83 の前に決めた「案 F」）。
 *
 * 【初心者向け】以前は下の段に 5〜6 個（投稿一覧・投稿する・Day・ゴミ箱・取っ手）が並び、
 * **時刻の無い行だけ取っ手が増えて 2 段に落ちる**ので、同じしおりの中で行の形が揃わなかった。
 * 赤いゴミ箱が丸いボタンの列に裸で立っているのも、取り返しのつかない操作がいちばん目立つ形だった。
 *
 * 今の形:
 *   - 左の列 … 時刻（TimePicker10）／チェック／取っ手「≡」（時刻の無い行だけ。今まで空いていた場所）
 *   - 中 …… 番号＋スポット名、メモ、そして **「Day n ▾」だけ**（投稿済みの行はその横に「投稿済み ✓」）
 *   - 右の列 … ★の平均の下に「⋯」。**★が無い行でも場所を空けて** ⋯ の位置が行ごとに上下しないようにする
 *   - 「⋯」の中 … 投稿を見る／投稿する／しおりから外す
 *
 * 段に Day だけを残したのは、**スポットは必ず「日付なし」でしおりに入る**（SaveSheet が
 * `addSpot(…, null)`）ので、Day の割り振りが全件の通る道だから。投稿の入口は検索・地図・
 * ピン・スポット詳細にもある（`composeHref` を使う画面が 8 つ）。
 *
 * #793: 「日付なし」の行には番号を付けない（順番がまだ無いものに番号を振らない）。
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
  pending = null,
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
  /**
   * loading-feedback Task 3（2026-09-30）: この行が処理中なら、その操作の種類。
   * 押した直後に文言を変え、二重に押せないようにする（要件 4.5.11 の場面 3）
   */
  pending?: "remove" | "move" | null;
}) {
  const [isPickingTime, setIsPickingTime] = useState(false);
  const [memo, setMemo] = useState(spot.memo ?? "");
  const [isEditingMemo, setIsEditingMemo] = useState(false);
  // #753: 右端の「⋯」。外をタップしたら閉じる（しおり詳細・アルバムの「⋯」と同じ作法）
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isMenuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setIsMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [isMenuOpen]);
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
        {/*
          * #753: 取っ手「≡」は左の列へ（時刻とチェックの下。今まで空いていた場所）。
          * 下の段から外れるので、時刻の有無で行の形が変わらなくなる。
          */}
        {!hasTime && dragHandleProps && (
          <button
            type="button"
            {...dragHandleProps}
            aria-label={`${spot.name} を並べ替え`}
            data-drag-handle
            className="h-7 w-6 cursor-grab touch-none text-[13px] text-muted active:cursor-grabbing"
          >
            ≡
          </button>
        )}
      </div>

      {/* 右：中（名前・メモ・Day）と、その右の縦 1 列（★ の下に ⋯） */}
      <div className="flex min-w-0 flex-1 gap-2">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className={`min-w-0 text-[14px] font-bold ${checked ? "text-muted line-through" : "text-ink"}`} data-spot-name>
          {/*
            * #793: 「日付なし」には番号を付けない（順番がまだ無いものに番号を振ると
            * 「1 番目に行く」という意味が付いてしまう）。代わりに小さな印を置く。
            */}
          {spot.dayIndex === null ? (
            <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-line text-[11px] text-muted no-underline" aria-hidden>
              ・
            </span>
          ) : (
            <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-ink text-[11px] text-on-ink no-underline">{index}</span>
          )}
          {spot.name}
        </p>

        {isEditingMemo ? (
          // #685: 改行を打つことが前提なので 2 行 → 3 行にした
          <textarea
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
            onBlur={saveMemo}
            maxLength={MEMO_MAX_LENGTH * 2}
            rows={3}
            autoFocus
            aria-label="メモ"
            className="w-full rounded-[8px] border border-line bg-surface px-2 py-1 text-[12px] text-ink focus:outline-none focus:ring-1 focus:ring-accent"
          />
        ) : (
          <button
            type="button"
            onClick={() => setIsEditingMemo(true)}
            /*
             * #685: メモの改行をそのまま見せる。
             *
             * 【初心者向け】HTML は既定で、連続する空白と改行を 1 つの空白にまとめてしまう。
             * `whitespace-pre-wrap` で「改行はそのまま、幅が足りなければ折り返す」になる。
             * 長い語で枠を突き抜けないように `break-words` も付けている。
             */
            className="whitespace-pre-wrap break-words text-left text-[12px] text-muted"
          >
            {spot.memo ? `メモ: ${spot.memo}` : "＋ メモを追加"}
          </button>
        )}

        {/*
          * #753: 段に残すのは Day だけ。投稿済みはその横に**状態の印**として置く
          * （操作ではないので、ボタンの列から外した）。
          */}
        <div className="flex flex-wrap items-center gap-1.5">
          <DayMoveDropdown value={spot.dayIndex} dayCount={dayCount} onChange={(day) => onMoveDay(spot.spotId, day)} disabled={pending !== null} />
          {spot.hasPosted && (
            <span className="inline-flex h-6 items-center rounded-full bg-done/10 px-2 text-[10.5px] font-bold text-done">投稿済み ✓</span>
          )}
        </div>
      </div>

      {/*
        * #753: 右端の縦 1 列（★ の下に ⋯）。
        * **★ が無い行でも場所を空ける**（`invisible`）ので、⋯ の位置が行ごとに上下しない。
        */}
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className={`flex h-[17px] items-center gap-0.5 text-[11px] text-muted ${spot.ratingAverage === null ? "invisible" : ""}`} aria-hidden={spot.ratingAverage === null}>
          <span className="text-star">★</span>
          {spot.ratingAverage ?? "0.0"}
        </span>
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setIsMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
            aria-label={`${spot.name} のその他`}
            disabled={pending !== null}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-line bg-surface text-[13px] font-bold text-ink disabled:opacity-45"
          >
            ⋯
          </button>
          {isMenuOpen && (
            <ul role="menu" className="absolute right-0 z-20 mt-1 min-w-[150px] overflow-hidden rounded-[10px] border border-line bg-surface py-1 shadow-card">
              <li role="presentation">
                {/* Bug #471: 「← しおり」で戻れるように、このしおりの URL を back= で渡す */}
                <Link
                  role="menuitem"
                  href={`/spots/${spot.spotId}?back=${encodeURIComponent(`/itineraries/${itineraryId}`)}`}
                  prefetch={false}
                  className="flex w-full px-3 py-2 text-left text-[13px] text-ink hover:bg-tint"
                >
                  投稿を見る
                </Link>
              </li>
              {!spot.hasPosted && (
                <li role="presentation">
                  <Link
                    role="menuitem"
                    href={composeHref({ kind: "itinerary", itineraryId, spotId: spot.spotId, dayIndex: spot.dayIndex })}
                    className="flex w-full px-3 py-2 text-left text-[13px] text-ink hover:bg-tint"
                  >
                    投稿する
                  </Link>
                </li>
              )}
              <li role="presentation">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onRemove(spot.spotId);
                  }}
                  disabled={pending !== null}
                  className="flex w-full px-3 py-2 text-left text-[13px] text-saved hover:bg-tint disabled:opacity-45"
                >
                  しおりから外す
                </button>
              </li>
            </ul>
          )}
        </div>
      </div>
      </div>
    </li>
  );
}
