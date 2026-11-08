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
 * #885: 中身の上で引き始めてよいか。
 *
 * 【初心者向け】中身がスクロールできるとき、途中で下に引くと**一覧が動かなくなります**
 * （シートが付いてきてしまい、スクロールできない）。**いちばん上にいるときだけ**
 * 引き始めてよいことにします。iOS の跳ね返りで `scrollTop` が負になることがあるので「0 以下」で見ます
 * （`pull-to-refresh-state.ts` の `canStartPull` と同じ考え方）。
 */
export function canPullFromContent(scrollTop: number): boolean {
  return scrollTop <= 0;
}

/**
 * 引いている間にシートをどれだけ下げるか。
 * 上に引いても動かさない（シートは上には伸びない）。「視差効果を減らす」人には動きを付けない。
 */
/**
 * #1069（2026-11-08）: 中身の上で押したあと、ここまで下に動いたら「引き始めた」とみなす（px）
 */
export const PULL_START_PX = 8;

/**
 * #1069: 中身の上で押したあとの動きが「引く動き」になったか。判断はここだけ（約束 13）。
 *
 * 【初心者向け】前は**押し下げた瞬間に**指やマウスを中身の枠に捕まえさせていました（setPointerCapture）。
 * すると離したときの宛先が枠になり、ブラウザはクリックを「押した所と離した所の共通の親」＝枠に送るので、
 * **マウスでは中のチェックボックスやボタンにクリックが届きませんでした**（指のタップはクリックを別の仕組みで
 * 作るので動いていた）。
 * そこで、**下へ少し動いてから**捕まえます。動かさずに離せば（＝クリック）捕まえないので、クリックは押したものに届きます。
 */
export function hasStartedPull(deltaY: number): boolean {
  return deltaY >= PULL_START_PX;
}

export function pullOffset(deltaY: number, reducedMotion: boolean): number {
  if (reducedMotion) return 0;
  return Math.max(0, deltaY);
}

export function usePullToClose(onClose: () => void) {
  /*
   * captured: 指やマウスを捕まえたか（＝引く動きに入ったか）。
   * 取っ手は押した瞬間に捕まえる（中に押す部品が無い）。中身は下へ少し動いてから捕まえる（#1069）
   */
  const startRef = useRef<{ y: number; id: number; captured: boolean } | null>(null);
  const [offset, setOffset] = useState(0);

  const reducedMotion = () => (typeof window === "undefined" || typeof window.matchMedia !== "function" ? true : window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  const begin = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    startRef.current = { y: event.clientY, id: event.pointerId, captured: true };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  return {
    /** シート本体に当てる style（引いている間だけ下がる） */
    offset,
    /**
     * #885: **中身のどこからでも**下にスライドして閉じる。
     * 取っ手を掴まなくてよくなるぶん、スクロールと取り合わないよう
     * 「いちばん上にいるときだけ」引き始める。
     */
    contentProps: {
      // #1069: 押した位置を控えるだけ。ここでは捕まえない（捕まえるとクリックが中の部品に届かない）
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
        if (event.button !== 0) return;
        if (!canPullFromContent(event.currentTarget.scrollTop)) return;
        startRef.current = { y: event.clientY, id: event.pointerId, captured: false };
      },
      onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
        const start = startRef.current;
        if (!start || start.id !== event.pointerId) return;
        const deltaY = event.clientY - start.y;
        if (!start.captured) {
          // まだ引き始めていない。下へ少し動いたら、そこで初めて捕まえて引く動きに入る
          if (!hasStartedPull(deltaY)) return;
          start.captured = true;
          event.currentTarget.setPointerCapture?.(event.pointerId);
        }
        setOffset(pullOffset(deltaY, reducedMotion()));
      },
      onPointerUp: (event: ReactPointerEvent<HTMLElement>) => {
        const start = startRef.current;
        startRef.current = null;
        setOffset(0);
        if (!start || start.id !== event.pointerId) return;
        // 引き始めていない（＝クリック・タップ）なら何もしない。クリックは押した部品にそのまま届く
        if (!start.captured) return;
        event.currentTarget.releasePointerCapture?.(event.pointerId);
        if (shouldCloseByPull(event.clientY - start.y)) onClose();
      },
      onPointerCancel: () => {
        startRef.current = null;
        setOffset(0);
      },
    },
    handleProps: {
      onPointerDown: begin,
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
