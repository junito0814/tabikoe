import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUserOrRedirect } from "@/lib/auth/require-user-or-redirect";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { AlbumScreen, type AlbumInvitation } from "@/components/albums/AlbumScreen";
import { getAlbumDetail, type AlbumDetail } from "@/lib/albums/get-album";
import { evaluateInvitation } from "@/lib/albums/invitations";
import { resolveListBack } from "@/lib/search/list-state";
import { ContentEnter } from "@/components/transitions/Reveal";
import { tripTitle } from "@/lib/metadata/page-title";

/**
 * SC-09 アルバム画面
 * 出典: docs/tasks/records/album/00-index.md, docs/tasks/records/album-collaboration/00-index.md
 *
 * メンバー（オーナー・編集者・閲覧者）のみ。メンバーでなければ404（存在自体を伏せる）。
 */
/** #785: タブ名はアルバムの題名（旅行の題名） */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const title = await tripTitle(id);
  return title ? { title } : {};
}

export default async function AlbumPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ back?: string }> }) {
  const { id } = await params;
  const { back } = await searchParams;
  const supabase = await createClient();
  const user = await requireUserOrRedirect(supabase, `/albums/${id}`);

  const admin = createAdminClient();
  let album: AlbumDetail | null = null;
  let invitations: AlbumInvitation[] = [];
  let failed = false;
  try {
    album = await getAlbumDetail(admin, user.id, id);
    if (album?.viewerRole === "owner") {
      const { data } = await admin
        .from("album_invitations")
        .select("id, role, expires_at, revoked_at, created_at")
        .eq("trip_id", id)
        .order("created_at", { ascending: false });
      const now = new Date();
      invitations = (data ?? []).map((row) => ({
        id: row.id,
        role: row.role,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
        status: evaluateInvitation(row, now),
      }));
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

  if (!album) {
    notFound();
  }

  return (
    <ContentEnter>
      <AlbumScreen album={album} initialInvitations={invitations} viewerId={user.id} back={resolveListBack(back)} />
    </ContentEnter>
  );
}
