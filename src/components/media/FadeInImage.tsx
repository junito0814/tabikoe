"use client";

import { useCallback, useState } from "react";

/**
 * loading-feedback Task 7（2026-09-30）: 写真が届いたら薄く重ねて出す
 * 出典: docs/tasks/shared-ui/loading-feedback/07-photo-fade.md
 *       要件定義書 4.5.11（読み込み中の見せ方・場面 5）
 *
 * 【初心者向け】いままで写真は「灰色の四角」から**ぱっと**切り替わっていた。
 * 届いた瞬間に透明から出すだけで、切り替わりの硬さが消える。一覧・写真タブ・投稿詳細と、
 * 利用者がいちばん多く見る場所で毎回起きるので、ここが効く。
 *
 * 気をつけた点が 2 つ:
 *   1. **既にブラウザが持っている写真では動かさない。** 戻ってくるたびにふわっとすると、
 *      かえって遅く見える。`complete` が true なら最初から出す
 *   2. **読み込みに失敗しても出す。** 透明のままにすると、壊れた写真の印も alt も見えなくなる
 *
 * 下地の灰色（`bg-line`）と場所取り（`aspect-square` など）は呼び出し側のまま。ここでは触らない。
 */
export function FadeInImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [shown, setShown] = useState(false);

  // 【初心者向け】要素ができた時点で「もう読み込み済みか」を見る。
  // 読み込み済みの写真は onLoad が呼ばれないことがあるので、ここで拾わないと透明のままになる
  const checkAlreadyLoaded = useCallback((node: HTMLImageElement | null) => {
    if (node?.complete) setShown(true);
  }, []);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={checkAlreadyLoaded}
      src={src}
      alt={alt}
      onLoad={() => setShown(true)}
      onError={() => setShown(true)}
      data-fade-in={shown ? "shown" : "hidden"}
      // 210ms は要件 4.5.11 の場面 5 で決めた「現れる」の時間。
      // motion-reduce: 動きを減らす設定の人には、すぐ出す
      className={`transition-opacity duration-[210ms] motion-reduce:transition-none ${shown ? "opacity-100" : "opacity-0"} ${className ?? ""}`}
    />
  );
}
