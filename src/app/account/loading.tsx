import { AccountSkeleton } from "@/components/skeleton/Skeletons";

/**
 * #936（2026-10-17）: アカウント（SC-07）の読み込み中。
 * 本物と同じ形の専用の骨組みにした（共通の `HeadingScreenSkeleton` は幅も余白も違っていた）。
 */
export default function Loading() {
  return <AccountSkeleton />;
}
