import { HeadingScreenSkeleton, RowListSkeleton } from "@/components/skeleton/Skeletons";

/**
 * loading-feedback Task 5（2026-10-02）: 画面を移るときの受け皿
 * 出典: docs/tasks/shared-ui/loading-feedback/05-page-fallbacks.md
 *       要件定義書 4.5.11 の場面 2・8 章 91
 *
 * 【初心者向け】Next.js は画面遷移の直後、ページの HTML が届くまでこの `loading.tsx` を
 * 即座に出す。データが揃った瞬間に本物の画面に置き換わる。
 *
 * 待っているのは直列 2〜3 本（プロフィール → ブロック中の人 → 管理者かどうか）。
 * ユーザー名・アイコン・ログアウト・退会が縦に並ぶので、行の形にする。
 */
export default function Loading() {
  return (
    <HeadingScreenSkeleton title="アカウント" maxWidth="max-w-[360px]">
      <RowListSkeleton count={4} />
    </HeadingScreenSkeleton>
  );
}
