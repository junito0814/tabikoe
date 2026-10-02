import { HeadingScreenSkeleton, PanelSkeleton } from "@/components/skeleton/Skeletons";

/**
 * loading-feedback Task 5（2026-10-02）: 画面を移るときの受け皿
 * 出典: docs/tasks/shared-ui/loading-feedback/05-page-fallbacks.md
 *       要件定義書 4.5.11 の場面 2・8 章 91
 *
 * 【初心者向け】Next.js は画面遷移の直後、ページの HTML が届くまでこの `loading.tsx` を
 * 即座に出す。データが揃った瞬間に本物の画面に置き換わる。
 *
 * ここは**全員が通る**（規約を改訂したあと最初に開いたとき、関所がここへ送る）。
 * 待っているのは「未同意の種類を調べる 2 本」＋「その種類ごとに本文の全文を順に取る」。
 * 本文が長いので体感が長い。見出しと箱 2 枚で、同意のお願いが来ると分かる形にする。
 */
export default function Loading() {
  return (
    <HeadingScreenSkeleton title="ご確認のお願い">
      <PanelSkeleton lines={4} />
      <PanelSkeleton lines={4} />
    </HeadingScreenSkeleton>
  );
}
