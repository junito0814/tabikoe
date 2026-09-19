import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUserOrRedirect } from "@/lib/auth/require-user-or-redirect";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { getAlbumList, type AlbumSummary } from "@/lib/albums/get-album";
import { ALBUM_ROLE_LABELS } from "@/lib/albums/membership";
import { SPOT_PLACEHOLDER_IMAGE_URL } from "@/lib/wishlist/constants";

/**
 * アルバム一覧（SC-09 の入口。マイページの遷移メニューから開く）
 * 出典: docs/tasks/records/album/01-album-detail-handler.md（一覧取得）
 *       docs/tasks/posts/post-delete/02-empty-album-hiding.md（投稿0件は出さない）
 */
export default async function AlbumsPage() {
  const supabase = await createClient();
  const user = await requireUserOrRedirect(supabase, "/albums");

  let albums: AlbumSummary[] | null = null;
  try {
    albums = await getAlbumList(createAdminClient(), user.id);
  } catch {
    albums = null;
  }

  if (albums === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app px-6">
        <ErrorNotice message={ERROR_MESSAGES.dbLoadFailure} retryable className="w-full max-w-[360px]" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-app px-4 py-6">
      <div className="w-full max-w-[560px]">
        <header className="mb-4 flex items-center justify-between">
          <h1 className="text-[18px] font-bold text-ink">アルバム</h1>
          <Link href="/mypage" className="text-[12px] text-muted underline underline-offset-2">
            マイページへ
          </Link>
        </header>

        {albums.length === 0 ? (
          <p className="py-16 text-center text-[13px] leading-[1.8] text-muted">
            まだアルバムがありません
            <br />
            投稿するとアルバムごとにまとまります
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {albums.map((album) => (
              <li key={album.tripId}>
                <Link href={`/albums/${album.tripId}`} className="block overflow-hidden rounded-[12px] border border-line bg-surface">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={album.coverUrl ?? SPOT_PLACEHOLDER_IMAGE_URL}
                    alt={album.coverUrl ? `${album.title}の写真` : ""}
                    className="aspect-square w-full object-cover"
                  />
                  <span className="block p-2.5">
                    <span className="block truncate text-[13px] font-semibold text-ink">
                      {album.title}
                      {album.isDaily && <span className="ml-1.5 rounded-full bg-tint px-1.5 py-0.5 text-[10px] font-medium text-muted">旅行ではない投稿</span>}
                    </span>
                    <span className="block text-[11px] text-muted">
                      {album.postCount}件 ・ {album.memberCount}人 ・ {ALBUM_ROLE_LABELS[album.role]}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
