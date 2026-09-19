import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUserOrRedirect } from "@/lib/auth/require-user-or-redirect";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { PostDetailScreen } from "@/components/posts/PostDetailScreen";
import { parseBackHref } from "@/lib/search/list-state";
import { BadgeToast } from "@/components/badges/BadgeToast";
import { parseBadgeToastParam } from "@/components/badges/badge-toast-params";
import { FlashNotice, resolveFlashKey } from "@/components/notices/FlashNotice";
import { getPostDetail, type PostDetailData } from "@/lib/posts/post-detail";
import { listComments, type CommentPage } from "@/lib/comments/list-comments";

/**
 * SC-05 投稿詳細画面
 * 出典: docs/tasks/browsing/post-detail-view/02-post-detail-ui.md
 *       docs/tasks/browsing/post-detail-view/03-login-redirect-return-flow.md
 *
 * ログイン必須（3.5.4）。未ログインなら requireUserOrRedirect がログイン画面へ送り、
 * ログイン後に redirect_to でこの投稿へ戻す（F-AC-02 Task3 / F-AC-01 コールバックと共通の仕組み）。
 * 非公開投稿は投稿者本人・アルバムメンバー以外には 404（存在しない扱い）。
 */
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
  const user = await requireUserOrRedirect(supabase, `/posts/${id}`);

  const admin = createAdminClient();
  let post: PostDetailData | null = null;
  let comments: CommentPage | null = null;
  let failed = false;
  try {
    post = await getPostDetail(admin, user.id, id);
    if (post) {
      comments = await listComments(admin, user.id, id, 0);
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

  if (!post || !comments) {
    notFound();
  }

  return (
    <>
      {newBadgeTypes.length > 0 && <BadgeToast badgeTypes={newBadgeTypes} />}
      <PostDetailScreen post={post} initialComments={comments} notice={flashKey ? <FlashNotice flashKey={flashKey} /> : undefined} backHref={parseBackHref(query.back)} />
    </>
  );
}
