"use client";

import { useEffect, useState } from "react";

/**
 * #803（2026-10-06）: 画面の下に固定したものを、キーボードの上へ逃がす
 * 出典: Issue #803「コメントの入力欄を画面の下に固定する」
 *
 * 【初心者向け】スマホでキーボードが出ると、**画面の下の方は見えなくなります**。
 * `position: fixed; bottom: 0` のものは、そのままだとキーボードの裏に隠れます。
 *
 * `window.visualViewport` は「**いま実際に見えている範囲**」を表します（#740・#749 と同じ道具）。
 * `window.innerHeight`（画面全体）との差が、**キーボードに隠されている高さ**です。
 * その分だけ持ち上げれば、入力欄がキーボードのすぐ上に来ます。
 */

/** これ以下の差は「キーボードではない」とみなす（アドレスバーの出入りなど） */
export const KEYBOARD_THRESHOLD_PX = 120;

/**
 * 下から隠されている高さ（px）。キーボードが出ていなければ 0。
 * 判断はこの純粋関数だけに置く（約束 13）。
 */
export function keyboardInset(viewport: { offsetTop: number; height: number } | null | undefined, innerHeight: number): number {
  if (!viewport) return 0;
  const hidden = innerHeight - (viewport.offsetTop + viewport.height);
  return hidden > KEYBOARD_THRESHOLD_PX ? Math.round(hidden) : 0;
}

/** いまキーボードに隠されている高さ（px）。出ていなければ 0 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const viewport = typeof window === "undefined" ? null : window.visualViewport;
    if (!viewport) return;
    const measure = () => setInset(keyboardInset(viewport, window.innerHeight));
    measure();
    viewport.addEventListener("resize", measure);
    viewport.addEventListener("scroll", measure);
    return () => {
      viewport.removeEventListener("resize", measure);
      viewport.removeEventListener("scroll", measure);
    };
  }, []);

  return inset;
}
