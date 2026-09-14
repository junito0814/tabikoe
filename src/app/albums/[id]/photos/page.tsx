import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUserOrRedirect } from "@/lib/auth/require-user-or-redirect";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { AlbumPhotoGalleryScreen } from "@/components/albums/AlbumPhotoGalleryScreen";
import { getAlbumMediaPage } from "@/lib/albums/album-photos";
import type { SpotMediaPage } from "@/lib/posts/spot-photos";

/**
 * SC-21 アルバム写真一覧画面
 * 出典: docs/tasks/records/album-photos/02-album-photos-screen.md
 *
 * SC-09 の「写真」タグから遷移する。メンバー以外は404（存在自体を伏せる）。
 */
export default async function AlbumPhotosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await requireUserOrRedirect(supabase, `/albums/${id}/photos`);

  const admin = createAdminClient();
  let initialPage: SpotMediaPage | null | undefined;
  let title = "";
  try {
    initialPage = await getAlbumMediaPage(admin, user.id, id, 0);
    if (initialPage) {
      const { data: trip } = await admin.from("trips").select("title").eq("id", id).maybeSingle();
      title = trip?.title ?? "";
    }
  } catch {
    initialPage = undefined;
  }

  if (initialPage === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FBF6F0] px-6">
        <ErrorNotice message={ERROR_MESSAGES.dbLoadFailure} retryable className="w-full max-w-[360px]" />
      </div>
    );
  }
  if (initialPage === null) {
    notFound();
  }

  return <AlbumPhotoGalleryScreen album={{ id, title }} initialPage={initialPage} />;
}
