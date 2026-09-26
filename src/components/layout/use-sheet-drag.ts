"use client";

import { useRef, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type TouchEvent as ReactTouchEvent } from "react";

/** 指をこれ以上動かしたら「スライドした」とみなす距離（px） */
export const SHEET_DRAG_THRESHOLD_PX = 40;
/** これより速い動きはフリック（距離が短くても方向に従う。px/ms） */
export const SHEET_FLICK_VELOCITY = 0.5;

/**
 * mentoring-7 Task11（v3.1）: シートの取っ手を指で上下にスライドして「全画面 ⇄ 1：2」を切り替える
 * 出典: docs/tasks/shared-ui/mentoring-7/11-sheet-drag.md
 *       要件定義書 v3.2 4.5.6（上へのスライドで全画面、下へのスライドで 1：2。途中では止めず近い方に吸い付く）
 *
 * 【初心者向け】取っ手（＝ボタン）に付けるイベントを返す。
 *   - pointerdown で開始位置を覚え、pointerup で「どれだけ動いたか」と「どれだけ速かったか」を見る
 *   - 上に 40px 以上（または速いフリック）→ onSnap("expand")、下に 40px 以上 → onSnap("collapse")
 *   - 動きが小さければ何もしない（タップは onClick に任せる）。Enter／Space は onToggle
 * 「途中で止めない」は呼び出し側が担当する（MapSheetLayout は CSS の scroll-snap、SC-03 は 2 状態の切替）。
 */
export type SheetSnap = "expand" | "collapse";

export function useSheetDrag(onSnap: (snap: SheetSnap) => void, onToggle: () => void) {
  const startRef = useRef<{ y: number; at: number; id: number } | null>(null);
  return {
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      startRef.current = { y: event.clientY, at: performance.now(), id: event.pointerId };
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    onPointerUp: (event: ReactPointerEvent<HTMLElement>) => {
      const start = startRef.current;
      startRef.current = null;
      if (!start || start.id !== event.pointerId) return;
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      const delta = event.clientY - start.y; // 上へ動かすと負
      const elapsed = performance.now() - start.at;
      // フリック判定は「1 フレーム以上かけて 12px 以上動いた」ときだけ（誤タップを弾く）
      const flick = elapsed >= 16 && Math.abs(delta) >= 12 && Math.abs(delta) / elapsed >= SHEET_FLICK_VELOCITY;
      if (delta <= -SHEET_DRAG_THRESHOLD_PX || (delta < 0 && flick)) onSnap("expand");
      else if (delta >= SHEET_DRAG_THRESHOLD_PX || (delta > 0 && flick)) onSnap("collapse");
    },
    onPointerCancel: () => {
      startRef.current = null;
    },
    onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onToggle();
      }
    },
  };
}

/**
 * map-sheet Bug1（2026-09-26）: シートの**内容**を下に引いて段階を縮める
 * 出典: 要件定義書 4.5.6「操作できる範囲」
 *
 * 【初心者向け】ここだけ pointer ではなく **touch** のイベントを使っている。理由は実機で分かった:
 * 指で下に引くとブラウザが「スクロールだ」と判断した時点で `pointercancel` を送り、
 * **`pointerup` が来なくなる**（取っ手は `setPointerCapture` で指を捕まえているので起きない）。
 * touch のイベントはスクロール中も最後まで来るので、こちらを使う。
 *
 * 取っ手（useSheetDrag）との違いは 3 つ。
 *   1. **先頭までスクロールしているときだけ**効く（途中で下に引くのは普通のスクロール）
 *   2. **下方向だけ**見る（上方向はページのスクロールで全画面になるので、横取りしない）
 *   3. **指を捕まえない**（`preventDefault` もしない）。カードのタップやリンクを邪魔しないため、
 *      動いた距離が閾値に届かなければ何もしない
 * これが無いと、地図を広くする段階に行く手段が高さ 20px の取っ手しか無く、実機で掴めなかった。
 */
export function useSheetContentDrag(onCollapse: () => void, isAtTop: () => boolean = () => window.scrollY <= 0) {
  const startRef = useRef<number | null>(null);
  const lastRef = useRef<number>(0);
  return {
    onTouchStart: (event: ReactTouchEvent<HTMLElement>) => {
      const touch = event.touches[0];
      if (!touch || event.touches.length > 1 || !isAtTop()) {
        startRef.current = null;
        return;
      }
      startRef.current = touch.clientY;
      lastRef.current = touch.clientY;
    },
    onTouchMove: (event: ReactTouchEvent<HTMLElement>) => {
      const touch = event.touches[0];
      if (touch) lastRef.current = touch.clientY;
    },
    onTouchEnd: () => {
      const start = startRef.current;
      startRef.current = null;
      // 引いている間にスクロールが動いていたら、それは普通のスクロールなので何もしない
      if (start === null || !isAtTop()) return;
      if (lastRef.current - start >= SHEET_DRAG_THRESHOLD_PX) onCollapse();
    },
    onTouchCancel: () => {
      startRef.current = null;
    },
  };
}
