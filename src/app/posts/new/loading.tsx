import { ComposeScreenSkeleton } from "@/components/skeleton/Skeletons";

/**
 * loading-feedback Task 5（2026-10-02）: 画面を移るときの受け皿
 * 出典: docs/tasks/shared-ui/loading-feedback/05-page-fallbacks.md
 *       要件定義書 4.5.11 の場面 2・8 章 91
 *
 * 【初心者向け】Next.js は画面遷移の直後、ページの HTML が届くまでこの `loading.tsx` を
 * 即座に出す。データが揃った瞬間に本物の画面に置き換わる。
 *
 * 下書きを開くときは直列 3 往復（下書き本体 → 写真 → 署名付き URL）で、いちばん長い。
 * 上 1/3 が地図、下 2/3 がフォームという本物と同じ割合にして、切り替わった瞬間に動かさない。
 */
export default function Loading() {
  return <ComposeScreenSkeleton />;
}
