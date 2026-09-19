"use client";

import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

/**
 * mentoring-7 Task8（v3.1）: 行のドラッグ並べ替え（取っ手 ≡ を押して上下に動かす）
 * 出典: docs/tasks/shared-ui/mentoring-7/08-itinerary-detail.md
 *       要件定義書 v3.1 3.11.3（並べ替えはドラッグ。上下ボタンは置かない）
 *
 * 【初心者向け】ライブラリを入れずに Pointer Events だけで作った小さな仕組み。
 *   1. 取っ手で pointerdown → その行を「持ち上げ中」にし、pointer capture で指が外れても追い続ける
 *   2. pointermove → 各行の縦の中心と指の位置を比べて「今どの位置に置くか」（overIndex）を決める
 *   3. pointerup → 位置が変わっていれば onReorder(from, to) を呼ぶ
 * 行の位置は getBoundingClientRect で毎回測る（スクロールしても正しい）。行の DOM は registerRow で集める。
 * 時刻のある行は自動で時刻順に並ぶので、呼び出し側で「時刻の無い行だけ」に取っ手を付ける。
 */
export function useRowDrag(onReorder: (from: number, to: number) => void) {
  const rowsRef = useRef<Map<number, HTMLElement>>(new Map());
  const [dragging, setDragging] = useState<{ from: number; over: number } | null>(null);
  const draggingRef = useRef<{ from: number; over: number } | null>(null);

  const registerRow = useCallback((index: number) => {
    return (element: HTMLElement | null) => {
      if (element) rowsRef.current.set(index, element);
      else rowsRef.current.delete(index);
    };
  }, []);

  const indexAtY = (y: number, fallback: number): number => {
    let best = fallback;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const [index, element] of rowsRef.current) {
      const rect = element.getBoundingClientRect();
      const middle = rect.top + rect.height / 2;
      const distance = Math.abs(y - middle);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    }
    return best;
  };

  const update = (next: { from: number; over: number } | null) => {
    draggingRef.current = next;
    setDragging(next);
  };

  /** 取っ手に付けるイベント */
  const handleProps = useCallback(
    (index: number) => ({
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        update({ from: index, over: index });
      },
      onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
        const current = draggingRef.current;
        if (!current) return;
        const over = indexAtY(event.clientY, current.over);
        if (over !== current.over) update({ ...current, over });
      },
      onPointerUp: (event: ReactPointerEvent<HTMLElement>) => {
        const current = draggingRef.current;
        if (!current) return;
        event.currentTarget.releasePointerCapture(event.pointerId);
        update(null);
        if (current.from !== current.over) onReorder(current.from, current.over);
      },
      onPointerCancel: () => update(null),
      // キーボードでも並べ替えられるように（↑↓ で 1 つ動かす。要件 7.7）
      onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
        event.preventDefault();
        const to = event.key === "ArrowUp" ? index - 1 : index + 1;
        if (to >= 0 && rowsRef.current.has(to)) onReorder(index, to);
      },
    }),
    [onReorder]
  );

  return { dragging, registerRow, handleProps };
}

/** 配列の from を to の位置へ動かす（純粋関数） */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
