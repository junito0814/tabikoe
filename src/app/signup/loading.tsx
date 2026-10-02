import { LogoScreenSkeleton } from "@/components/skeleton/Skeletons";

/**
 * loading-feedback Task 5（2026-10-02）: 画面を移るときの受け皿
 * 出典: docs/tasks/shared-ui/loading-feedback/05-page-fallbacks.md
 *       要件定義書 4.5.11 の場面 2・8 章 91
 *
 * 【初心者向け】Next.js は画面遷移の直後、ページの HTML が届くまでこの `loading.tsx` を
 * 即座に出す。データが揃った瞬間に本物の画面に置き換わる。
 *
 * ここは**新しい人が必ず通る**（SC-20 同意画面）。
 * 待っているのは認証サーバーへの往復 ＋ 「もう登録済みか」を調べる 1 本。
 * アプリの第一印象になる画面なので、白いままにしない。
 */
export default function Loading() {
  return <LogoScreenSkeleton />;
}
