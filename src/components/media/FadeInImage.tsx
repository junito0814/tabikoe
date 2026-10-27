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
/*
 * #1044（2026-10-27）: ブラウザへの指示を 3 つ足した（`decoding` / `loading` / `fetchPriority`）。
 *
 * 【初心者向け】いちばん効くのは `decoding="async"` で、意味は
 * 「**デコードで本体（メインスレッド）を止めるな**」です。
 * 写真は届いたあと、画面に出せる形に変換（デコード）してから描かれます。この指示が無いと、
 * その変換を本体が止まって待つことがあり、**ほかの描画がつかえます**。
 *
 * 本番ビルドを CPU 4 倍絞りで測ったところ、**写真を止めるだけで**スタイルとレイアウトの
 * 時間が 993ms → 586ms（4 割減）になりました。`decoding="async"` を足して測り直すと、
 * 長いフレームの合計が 12%、最悪のフレームが 16% 減りました（3 回ずつの平均）。
 *
 * `loading="lazy"` は**画面の外の写真だけ**に付けます。最初に見える写真に付けると、
 * 取りに行くのが後回しになって**かえって遅く見えます**。
 */
export function FadeInImage({
  src,
  alt,
  className,
  lazy = false,
  priority = false,
}: {
  src: string;
  alt: string;
  className?: string;
  /** 画面の外にある写真だけ true。**最初に見える写真に付けると、出るのが遅くなる** */
  lazy?: boolean;
  /** その画面でいちばん大きく出る 1 枚だけ true。先に取りに行かせる */
  priority?: boolean;
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
      decoding="async"
      loading={lazy ? "lazy" : undefined}
      fetchPriority={priority ? "high" : undefined}
      data-fade-in={shown ? "shown" : "hidden"}
      // 210ms は要件 4.5.11 の場面 5 で決めた「現れる」の時間。
      // motion-reduce: 動きを減らす設定の人には、すぐ出す
      className={`transition-opacity duration-[210ms] motion-reduce:transition-none ${shown ? "opacity-100" : "opacity-0"} ${className ?? ""}`}
    />
  );
}
