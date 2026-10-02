import { NotificationListSkeleton } from "@/components/skeleton/Skeletons";

/**
 * loading-feedback Task 11（2026-10-02・#650）: 読み込み中の骨組み
 * 出典: docs/tasks/shared-ui/loading-feedback/11-skeleton-fidelity.md
 *       要件定義書 4.5.11 共通の決まり「骨組みは本物と同じ形にする」
 *
 * 【初心者向け】以前は共通の `ListScreenSkeleton` を使っていたが、本物と形がずれていて、
 * 読み込みが終わった瞬間にタイトルが中央から左へ飛んでいた。本物と同じ形の部品に差し替えた。
 */
export default function Loading() {
  return <NotificationListSkeleton />;
}
