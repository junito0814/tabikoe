import { redirect } from "next/navigation";

// #785: ブラウザのタブ名（「写真・動画 | タビコエ」）
export const metadata = { title: "写真・動画" };

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
