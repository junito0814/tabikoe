"use client";

import { useRef, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";

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
