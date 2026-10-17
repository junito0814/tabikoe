"use client";

import { progressPercent } from "./progress-bar";

/**
 * #940（2026-10-17）: 画面の上端に出す、細い進み具合のバー
 * 出典: Issue #940、要件定義書 4.5.11（待ち時間の見せ方）
 *
 * 【初心者向け】投稿ボタンの中に「送っています 1/3」と書いていましたが、
 * **何を送っているのか分からず、分数も読み取りにくい**ものでした。
 * Instagram・X・LINE・TikTok はどれも**ボタンの中に進み具合を書きません**。
 * ボタンは「投稿中」で止め、進み具合はこの細いバーで見せます。
 *
 * **総数がまだ分からないときは「流れる」表示**にします（1 点目を送り始めたところなど）。
 * 止まって見えないことがこのバーの役目なので、数が無くても何か動いている必要があります。
 *
 * 動きを減らす設定（`prefers-reduced-motion`）の人には流れる動きを出しません（4.5.11）。
 * そのときは薄い帯が出たままになり、「何かしている」ことだけは伝わります。
 */
export function TopProgressBar({
  progress,
  label = "投稿の進み具合",
}: {
  /** `done`／`total`。まだ総数が分からなければ null */
  progress: { done: number; total: number } | null;
  label?: string;
}) {
  const percent = progressPercent(progress);
  return (
    <div
      role="progressbar"
      aria-label={label}
      // 不定のときは `aria-valuenow` を出さない（読み上げが「0%」と言わないように）
      aria-valuenow={percent ?? undefined}
      aria-valuemin={0}
      aria-valuemax={100}
      data-top-progress
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[3px] overflow-hidden bg-line"
    >
      {percent === null ? (
        <div className="h-full w-1/3 bg-accent motion-safe:animate-[top-progress-slide_1.2s_ease-in-out_infinite]" />
      ) : (
        <div className="h-full bg-accent transition-[width] duration-300 ease-out" style={{ width: `${percent}%` }} />
      )}
    </div>
  );
}
