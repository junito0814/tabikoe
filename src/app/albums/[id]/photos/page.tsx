import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUserOrRedirect } from "@/lib/auth/require-user-or-redirect";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { AlbumPhotoGalleryScreen } from "@/components/albums/AlbumPhotoGalleryScreen";
import { getAlbumMediaPage } from "@/lib/albums/album-photos";
import type { SpotMediaPage } from "@/lib/posts/search-photos";

// #785: ブラウザのタブ名（「写真・動画 | タビコエ」）
export const metadata = { title: "写真・動画" };

/**
 * SC-21 アルバム写真一覧
 * 出典: docs/tasks/records/album-photos/02-album-photos-screen.md
 *
 * メンバー（オーナー・編集者・閲覧者）のみ。メンバーでなければ 404（存在自体を伏せる）。
 * 1 ページ目はサーバーで取り、2 ページ目以降は画面側が /api/trips/[id]/photos から足す。
 */
export default async function AlbumPhotosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await requireUserOrRedirect(supabase, `/albums/${id}/photos`);

  const admin = createAdminClient();
  let page: SpotMediaPage | null = null;
  let title = "アルバム";
  let failed = false;
  try {
    page = await getAlbumMediaPage(admin, user.id, id, 0);
    if (page) {
      const { data: trip } = await admin.from("trips").select("title").eq("id", id).maybeSingle();
      title = trip?.title ?? title;
    }
  } catch {
    failed = true;
  }

  if (failed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app px-6">
        <ErrorNotice message={ERROR_MESSAGES.dbLoadFailure} retryable className="w-full max-w-[360px]" />
      </div>
    );
  }

  if (!page) {
    notFound();
  }

  return <AlbumPhotoGalleryScreen tripId={id} title={title} initialPage={page} />;
}
