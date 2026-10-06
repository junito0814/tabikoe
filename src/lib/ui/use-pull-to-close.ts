"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

/**
 * #804（2026-10-06）: シートの取っ手を下に引いて閉じる
 * 出典: Issue #804「シートに取っ手を付け、下に引いて閉じられるようにする」
 *
 * 【初心者向け】`Sheet` には取っ手の棒がありませんでした。iOS のシートは上に棒があり、
 * あれが「**下に引けば閉じる**」の合図です（`MapSheetLayout` には前から付いていて、揃っていませんでした）。
 *
 * 取っ手だけに付けるので、**中身のスクロールとは取り合いません**（棒はスクロールする場所の外にあります）。
 * 引いている間はシートが指について下がり、`CLOSE_DISTANCE_PX` 以上で離すと閉じ、
 * 足りなければ元へ戻ります。
 */
export const CLOSE_DISTANCE_PX = 80;

/** 引いた距離から「閉じるか」を決める。判断はここだけ（約束 13） */
export function shouldCloseByPull(deltaY: number): boolean {
  return deltaY >= CLOSE_DISTANCE_PX;
}

/**
 * 引いている間にシートをどれだけ下げるか。
 * 上に引いても動かさない（シートは上には伸びない）。「視差効果を減らす」人には動きを付けない。
 */
export function pullOffset(deltaY: number, reducedMotion: boolean): number {
  if (reducedMotion) return 0;
  return Math.max(0, deltaY);
}

export function usePullToClose(onClose: () => void) {
  const startRef = useRef<{ y: number; id: number } | null>(null);
  const [offset, setOffset] = useState(0);

  const reducedMotion = () => (typeof window === "undefined" || typeof window.matchMedia !== "function" ? true : window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  return {
    /** シート本体に当てる style（引いている間だけ下がる） */
    offset,
    handleProps: {
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
        if (event.button !== 0) return;
        startRef.current = { y: event.clientY, id: event.pointerId };
        event.currentTarget.setPointerCapture?.(event.pointerId);
      },
      onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
        const start = startRef.current;
        if (!start || start.id !== event.pointerId) return;
        setOffset(pullOffset(event.clientY - start.y, reducedMotion()));
      },
      onPointerUp: (event: ReactPointerEvent<HTMLElement>) => {
        const start = startRef.current;
        startRef.current = null;
        setOffset(0);
        if (!start || start.id !== event.pointerId) return;
        event.currentTarget.releasePointerCapture?.(event.pointerId);
        if (shouldCloseByPull(event.clientY - start.y)) onClose();
      },
      onPointerCancel: () => {
        startRef.current = null;
        setOffset(0);
      },
    },
  };
}
