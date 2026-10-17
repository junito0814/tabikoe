import { BadgeListSkeleton } from "@/components/skeleton/Skeletons";

/**
 * #936（2026-10-17）: ステータスバッジ（SC-13）の読み込み中。
 * 本物と同じ形の専用の骨組みにした（共通の `HeadingScreenSkeleton` は余白も題名の大きさも違っていた）。
 */
export default function Loading() {
  return <BadgeListSkeleton />;
}
