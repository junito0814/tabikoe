"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  canStartPull,
  gearOpacity,
  gearRotation,
  PULL_THRESHOLD_PX,
  pullDistance,
  shouldRefresh,
} from "./pull-to-refresh-state";

/**
 * loading-feedback Task 9: 引っ張って更新
 * 出典: docs/tasks/shared-ui/loading-feedback/09-pull-to-refresh.md
 *       要件定義書 4.5.11 の場面 6・8 章 96
 *
 * 【初心者向け】ホーム画面から単独のアプリとして開くと、ブラウザの枠ごと
 * 「引っ張って更新」も消える。アドレスバーも再読み込みボタンも無いので、
 * **自分で最新にする手段が 1 つも無くなる**（実機で確認）。その穴を塞ぐ部品。
 *
 * 使い方: 一覧の中身をこれで包むだけ。
 *   <PullToRefresh>（一覧）</PullToRefresh>
 *
 * 付ける画面は 6 つ（通知・マイページ・しおり一覧・アルバム一覧・行きたい・検索結果）。
 * **付けない 3 枚**（スポット別の投稿一覧・投稿詳細・しおり詳細）は、
 * 上 1/3 地図＋下 2/3 シートが `scroll-snap` の入れ物になっていて
 * 「いちばん上で下に引く」が既に「地図を出す」の意味を持っているため。
 * 同じ操作に 2 つの意味を重ねない（要件 4.5.6）。
 */
export function PullToRefresh({ children }: { children: ReactNode }) {
  const router = useRouter();
  /*
   * 【初心者向け】`router.refresh()` は「終わった」を返さないので、
   * 歯車をいつ止めればよいか分からない。`useTransition` で包むと
   * **取り直しが終わるまで `isPending` が true** になるので、それを使う。
   */
  const [isPending, startTransition] = useTransition();
  /** 歯車を下ろしている距離（px）。0 なら引いていない */
  const [distance, setDistance] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  /** 指を置いた位置。null なら引きはじめていない */
  const startYRef = useRef<number | null>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const onTouchStart = (event: TouchEvent) => {
      const scrollTop = document.scrollingElement?.scrollTop ?? window.scrollY;
      if (!canStartPull({ scrollTop, isRefreshing: isPending })) {
        startYRef.current = null;
        return;
      }
      startYRef.current = event.touches[0]?.clientY ?? null;
    };

    const onTouchMove = (event: TouchEvent) => {
      const startY = startYRef.current;
      if (startY === null) return;
      const currentY = event.touches[0]?.clientY;
      if (currentY === undefined) return;
      const next = pullDistance(startY, currentY);
      if (next > 0) {
        /*
         * 【初心者向け】ここで `preventDefault()` を呼ぶのは、引いている間の
         * **ブラウザの跳ね返りを止める**ため。歯車と跳ね返りが同時に動くと
         * どちらを見ればよいか分からなくなる。
         * React の `onTouchMove` では効かない（React が「受け身の」聞き役として
         * 登録するため）ので、この効果の中で自分で登録している。
         */
        event.preventDefault();
      }
      setDistance(next);
    };

    const onTouchEnd = () => {
      const startY = startYRef.current;
      startYRef.current = null;
      if (startY === null) return;
      setDistance((current) => {
        if (shouldRefresh(current)) {
          startTransition(() => router.refresh());
        }
        // 届かなかったときも、届いたときも、指を離したら歯車は元の位置へ戻す
        return 0;
      });
    };

    node.addEventListener("touchstart", onTouchStart, { passive: true });
    // 跳ね返りを止めるため「受け身でない」聞き役として登録する
    node.addEventListener("touchmove", onTouchMove, { passive: false });
    node.addEventListener("touchend", onTouchEnd, { passive: true });
    node.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      node.removeEventListener("touchstart", onTouchStart);
      node.removeEventListener("touchmove", onTouchMove);
      node.removeEventListener("touchend", onTouchEnd);
      node.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [isPending, router, startTransition]);

  const pulling = distance > 0;
  // 取り直している間は、歯車をしきい値の位置に留めて回し続ける
  const shownDistance = isPending ? PULL_THRESHOLD_PX : distance;
  const visible = pulling || isPending;

  return (
    <div ref={containerRef} data-pull-to-refresh>
      {/*
        * 歯車。引いている間だけ出る。
        * `prefers-reduced-motion` のときは `motion-reduce:animate-none` で回さず、出すだけにする
        */}
      <div
        aria-hidden={!isPending}
        role={isPending ? "status" : undefined}
        aria-label={isPending ? "最新にしています" : undefined}
        className="pointer-events-none flex justify-center overflow-hidden transition-[height] duration-200"
        style={{ height: visible ? `${shownDistance}px` : "0px" }}
      >
        <span
          data-pull-gear
          className={`mt-2 inline-flex size-7 items-center justify-center text-muted ${isPending ? "animate-spin motion-reduce:animate-none" : ""}`}
          style={
            isPending
              ? undefined
              : { transform: `rotate(${gearRotation(distance)}deg)`, opacity: gearOpacity(distance) }
          }
        >
          <GearIcon />
        </span>
      </div>
      {children}
    </div>
  );
}

/** 歯車の絵（要件 4.5.11 の場面 6。Instagram の読み込み中と同じ役回り） */
function GearIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 3v2.2M12 18.8V21M4.6 7.8l1.9 1.1M17.5 15.1l1.9 1.1M4.6 16.2l1.9-1.1M17.5 8.9l1.9-1.1"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
