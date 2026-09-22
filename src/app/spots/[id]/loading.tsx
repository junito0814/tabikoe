import { MapSheetSkeleton } from "@/components/skeleton/Skeletons";

/**
 * performance Task2（2026-09-22）: SC-04 スポット別一覧（/spots/[id]） の読み込み中の骨組み
 * 【初心者向け】Next.js は画面遷移の直後、ページの HTML が届くまでこの `loading.tsx` を即座に出す。
 * データが揃った瞬間に本物の画面に置き換わる。
 */
export default function Loading() {
  return (
    <MapSheetSkeleton backLabel="地図" />
  );
}
