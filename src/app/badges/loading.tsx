import { GridSkeleton, HeadingScreenSkeleton } from "@/components/skeleton/Skeletons";

/**
 * loading-feedback Task 5（2026-10-02）: 画面を移るときの受け皿
 * 出典: docs/tasks/shared-ui/loading-feedback/05-page-fallbacks.md
 *       要件定義書 4.5.11 の場面 2・8 章 91
 *
 * 【初心者向け】Next.js は画面遷移の直後、ページの HTML が届くまでこの `loading.tsx` を
 * 即座に出す。データが揃った瞬間に本物の画面に置き換わる。
 *
 * 待っているのは DB 1 本。札が格子に並ぶ形にする（SC-10）。
 */
export default function Loading() {
  return (
    <HeadingScreenSkeleton title="ステータスバッジ" maxWidth="max-w-[420px]">
      <GridSkeleton rows={3} cols={3} />
    </HeadingScreenSkeleton>
  );
}
