import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUserFromClaims } from "@/lib/auth/auth-user";
import { GuestBand } from "@/components/layout/GuestBand";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { PostDetailScreen } from "@/components/posts/PostDetailScreen";
import { appendBackHref, resolveListBack } from "@/lib/search/list-state";
import { BadgeToast } from "@/components/badges/BadgeToast";
import { parseBadgeToastParam } from "@/components/badges/badge-toast-params";
import { FlashNotice, resolveFlashKey } from "@/components/notices/FlashNotice";
import { getPostDetail, type PostDetailData } from "@/lib/posts/post-detail";
import { listComments, type CommentPage } from "@/lib/comments/list-comments";
import { ContentEnter } from "@/components/transitions/Reveal";
import { postTitle } from "@/lib/metadata/page-title";
import { postShareCard } from "@/lib/metadata/share-card";
import { countPublicSpotPosts } from "@/lib/spots/count-public-spot-posts";

/**
 * SC-05 投稿詳細画面
 * 出典: docs/tasks/browsing/post-detail-view/02-post-detail-ui.md
 *       docs/tasks/browsing/post-detail-view/03-login-redirect-return-flow.md
 *
 * #951（2026-10-17）: ~~ログイン必須~~ → **ログインせずに開ける**ようにした（要件 3.5.4）。
 * 共有されたリンクを受け取った人が、ログイン画面に突き当たって中身を一切見られない状態を避けるため。
 * 中身は同じで、違うのは 5 つ ── メニューバー（`shouldShowMenuBar`）・「戻る」・「⋯」を出さず、
 * 投稿者名をリンクにせず、下に帯（`GuestBand`）を 1 本置く。コメントは**読める**。
 *
 * 非公開投稿は投稿者本人・アルバムメンバー以外には 404（存在しない扱い）。この判定（`canViewPost`）は
 * 今までどおりなので、**未ログインでは公開投稿しか開けない**（3.3.6 がそのまま効く）。
 */
/** #785: タブ名は「〈スポット名〉の投稿」。下書き・非公開・削除では名前を出さない */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const title = await postTitle(id);
  // #951: 検索エンジンには載せない（要件 4.5.18。理由は SC-04 と同じ）
  const robots = { index: false } as const;
  if (!title) return { robots };
  /*
   * #952（2026-10-17）: 共有したときに出るリンクカード。
   * **公開投稿でなければ `null`** が返り、そのときはカードを足さない（題名でも中身を明かさない）。
   */
  const card = await postShareCard(id);
  return { title, robots, ...(card ?? {}) };
}

export default async function PostDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ posted?: string; updated?: string; badges?: string; back?: string }>;
}) {
  const { id } = await params;
  // v3.0: 投稿・更新の完了後はこの画面に遷移するので、完了メッセージとバッジ獲得トーストをここで出す
  const query = await searchParams;
  const flashKey = resolveFlashKey(query);
  const newBadgeTypes = parseBadgeToastParam(query.badges);
  const supabase = await createClient();
  // #951: ログインは必須ではない。未ログインなら user が null のまま進む
  const user = await getAuthUserFromClaims(supabase);
  const viewerId = user?.id ?? null;
  const isGuest = viewerId === null;

  const admin = createAdminClient();
  let post: PostDetailData | null = null;
  let failed = false;
  // performance Task2: コメント 1 ページ目は待たずに Promise のまま画面へ渡し、本文の後から流し込む。
  // 失敗しても本文は出す（コメント欄は空。取り直しは画面側の「もっと見る」に任せる）
  const emptyComments: CommentPage = { comments: [], nextOffset: null, totalCount: 0 , viewerAvatarUrl: null};
  const comments: Promise<CommentPage> = listComments(admin, viewerId, id, 0).catch(() => emptyComments);
  try {
    post = await getPostDetail(admin, viewerId, id);
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

  if (!post) {
    notFound();
  }

  /*
   * #951: 未ログインのときだけ「この場所の投稿をすべて見る（N 件）」を出すので、その件数を数える。
   * ログイン済みでは出さないので、そのときは数えない（問い合わせを増やさない）。
   */
  const spotPostCount = isGuest ? await countPublicSpotPosts(admin, post.spot.id) : null;

  return (
    <ContentEnter>
      <>
        {/* #972: バッジ画面から帰る先はこの投稿。元の一覧まで遡れるよう `?back=` も引き継ぐ */}
        {newBadgeTypes.length > 0 && (
          <BadgeToast badgeTypes={newBadgeTypes} backHref={appendBackHref(`/posts/${post.id}`, resolveListBack(query.back)?.href)} />
        )}
        <PostDetailScreen
          post={post}
          initialComments={comments}
          notice={flashKey ? <FlashNotice flashKey={flashKey} /> : undefined}
          back={resolveListBack(query.back)}
          isGuest={isGuest}
          spotPostCount={spotPostCount}
        />
        {/* #951: 未ログインはメニューバーの代わりにこの帯（要件 4.5.18） */}
        {isGuest && <GuestBand returnTo={`/posts/${id}`} />}
      </>
    </ContentEnter>
  );
}
