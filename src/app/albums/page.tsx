import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUserOrRedirect } from "@/lib/auth/require-user-or-redirect";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { getAlbumList, type AlbumSort, type AlbumSummary } from "@/lib/albums/get-album";
import { AlbumListControls } from "@/components/albums/AlbumListControls";
import { ALBUM_ROLE_LABELS } from "@/lib/albums/membership";
import { SPOT_PLACEHOLDER_IMAGE_URL } from "@/lib/wishlist/constants";
import { ContentEnter } from "@/components/transitions/Reveal";
import { PullToRefresh } from "@/components/layout/PullToRefresh";
import { BackLink } from "@/components/layout/BackLink";

// #785: ブラウザのタブ名（「アルバム | タビコエ」）
export const metadata = { title: "アルバム" };

/**
 * アルバム一覧（SC-09 の入口。マイページの遷移メニューから開く）
 * 出典: docs/tasks/records/album/01-album-detail-handler.md（一覧取得）
 *       docs/tasks/posts/post-delete/02-empty-album-hiding.md（投稿0件は出さない）
 */
export default async function AlbumsPage({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
  const supabase = await createClient();
  const user = await requireUserOrRedirect(supabase, "/albums");

  // #715: 並び順（新着順／古い順）。おかしな値は既定の新着順にする
  const sort: AlbumSort = (await searchParams).sort === "oldest" ? "oldest" : "newest";

  let albums: AlbumSummary[] | null = null;
  try {
    albums = await getAlbumList(createAdminClient(), user.id, sort);
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
    <ContentEnter>
      <PullToRefresh>
        <div className="flex min-h-screen flex-col items-center bg-app px-4 py-6">
          <div className="w-full max-w-[560px]">
            {/*
              * #686: 右端の「マイページへ」を、左上の戻る（決定事項 80）に置き換えた。
              * 戻るは左上、重ねて出したものを閉じる × は右上、という決まりに合わせる。
              */}
            <header className="mb-4 flex flex-col gap-2">
              <BackLink />
              <h1 className="text-[18px] font-bold text-ink">アルバム</h1>
              {/* #715: 名前ひとつで作れる（しおりは作らない）。並び順も選べる */}
              <AlbumListControls sort={sort} />
            </header>

            {albums.length === 0 ? (
              <p className="py-16 text-center text-[13px] leading-[1.8] text-muted">
                まだアルバムがありません
                <br />
                「＋ 新規」で作るか、投稿するとアルバムごとにまとまります
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
      </PullToRefresh>
    </ContentEnter>
  );
}
