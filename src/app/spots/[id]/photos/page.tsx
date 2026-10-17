import { redirect } from "next/navigation";
import { isVideoUploadDisabled } from "@/lib/video/process-video";
import { mediaLabel } from "@/lib/posts/media-label";

/*
 * #785: ブラウザのタブ名。
 * #937（2026-10-16）: ここも手で書いてあったので、動画の受付フラグに連動させる。
 *   この画面は転送するだけだが、転送の前に一瞬だけタブ名が出るので揃える。
 */
export function generateMetadata() {
  return { title: mediaLabel(!isVideoUploadDisabled()) };
}

/**
 * 旧 SC-13 スポット写真一覧（v1）
 * 出典: docs/tasks/map-search/photo-view/01-photos-api-search-params.md
 *
 * 【初心者向け】v3.0 では写真一覧は投稿一覧の「写真」切替（?view=photos）になった。
 * 古いリンクが残っていても困らないよう、同じスポットの投稿一覧（写真表示）へ転送する。
 */
export default async function SpotPhotosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/spots/${id}?view=photos`);
}
