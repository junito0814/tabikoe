import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUserOrRedirect } from "@/lib/auth/require-user-or-redirect";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { SpotPhotoGalleryScreen } from "@/components/media/SpotPhotoGalleryScreen";
import { getSpotMediaPage, type SpotMediaPage } from "@/lib/posts/spot-photos";

/**
 * SC-13 スポット写真一覧画面
 * 出典: docs/tasks/map-search/spot-photo-gallery/02-gallery-screen-ui.md
 *
 * SC-04 の「写真」タグから遷移する。ログイン必須（3.5.4）。
 */
export default async function SpotPhotosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await requireUserOrRedirect(supabase, `/spots/${id}/photos`);

  const admin = createAdminClient();
  const { data: spot } = await admin.from("spots").select("id, name, hidden_at").eq("id", id).maybeSingle();
  // F-AD-05: 非公開化されたスポットは存在しない扱い
  if (!spot || spot.hidden_at) {
    notFound();
  }

  let initialPage: SpotMediaPage | null = null;
  try {
    initialPage = await getSpotMediaPage(admin, user.id, id, 0);
  } catch {
    initialPage = null;
  }

  if (initialPage === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app px-6">
        <ErrorNotice message={ERROR_MESSAGES.dbLoadFailure} retryable className="w-full max-w-[360px]" />
      </div>
    );
  }

  return <SpotPhotoGalleryScreen spot={{ id: spot.id, name: spot.name }} initialPage={initialPage} />;
}
