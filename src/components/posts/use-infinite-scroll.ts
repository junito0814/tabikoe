"use client";

import { useEffect, useRef } from "react";

/**
 * 無限スクロール（3.4.4・3.4.5）。末尾の番兵要素が見えたら `onReachEnd` を呼ぶ。
 * IntersectionObserver が無い環境（古いブラウザ・テスト）では何もしない。
 * その場合も「もっと見る」ボタンで手動読み込みできるよう、呼び出し側でボタンを併設する。
 */
export function useInfiniteScroll(enabled: boolean, onReachEnd: () => void) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onReachEnd);
  useEffect(() => {
    callbackRef.current = onReachEnd;
  }, [onReachEnd]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!enabled || !sentinel || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        callbackRef.current();
      }
    }, { rootMargin: "200px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [enabled]);

  return sentinelRef;
}
