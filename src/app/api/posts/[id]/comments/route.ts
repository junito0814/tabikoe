import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { isWithinRateLimit } from "@/lib/rate-limit/check-rate-limit";
import { createNotification } from "@/lib/notifications/create-notification";
import { recordOperation } from "@/lib/logs/record-operation";
import { findLikeTarget } from "@/lib/likes/like-post";
import { validateCommentBody } from "@/lib/comments/validate-comment";
import { listComments, toCommentData } from "@/lib/comments/list-comments";
import {
  COMMENT_RATE_LIMIT_MAX_ATTEMPTS,
  COMMENT_RATE_LIMIT_WINDOW_SECONDS,
} from "@/lib/comments/constants";
import { getPostingRestrictionUntil, postingRestrictedResponse } from "@/lib/moderation/posting-restriction";

/**
 * F-VW-03 Task3: コメント一覧取得（新着順・20件ページング）
 * 出典: docs/tasks/browsing/comments/03-comment-list-handler.md
 *
 * 投稿の閲覧可否は SC-05 の表示時点で判定済みだが、直接呼ばれる場合に備えてここでも
 * 「公開投稿 or 本人」を最低限確認する（非公開投稿にはコメント自体が付かない 3.3.6）。
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const offset = Math.max(
    0,
    Number.parseInt(new URL(request.url).searchParams.get("offset") ?? "0", 10) || 0
  );

  const admin = createAdminClient();
  try {
    const target = await findLikeTarget(admin, user.id, id);
    if (!target.ok && target.status === 404) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    const page = await listComments(admin, user.id, id, offset);
    return NextResponse.json(page);
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
}

/**
 * F-VW-03 Task1・Task4・Task5: コメント投稿（検証・エスケープ・レート制限・通知）
 * 出典: docs/tasks/browsing/comments/01-comment-create-handler.md
 *       docs/tasks/browsing/comments/04-comment-rate-limiting.md
 *       docs/tasks/browsing/comments/05-comment-notification-integration.md
 *
 * コメントは公開投稿にのみ付けられる（3.3.6「非公開投稿には…いいね・コメントは付かない」。
 * アルバムメンバー間のコメントも本リリースでは対象外）。非公開投稿へは、閲覧権限の有無に
 * かかわらず拒否する。存在しない・ブロック関係の投稿は404。
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { body?: unknown; parentId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  // v3.2（feedback-0919 Task4）: 返信なら返信先のコメント ID
  const parentId = typeof body.parentId === "string" && body.parentId.length > 0 ? body.parentId : null;

  const validation = validateCommentBody(body.body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const admin = createAdminClient();

  // strike-system Task 2: 投稿禁止中はコメントもできない。403 と解除日時を返す
  const restrictedUntil = await getPostingRestrictionUntil(admin, user.id);
  if (restrictedUntil) return postingRestrictedResponse(restrictedUntil);

  let target;
  try {
    target = await findLikeTarget(admin, user.id, id);
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
  if (!target.ok) {
    return NextResponse.json({ error: target.error }, { status: target.status });
  }

  // v3.2: 返信先は同じ投稿の、消えていないコメントに限る
  let parent: { id: string; user_id: string; post_id: string } | null = null;
  if (parentId) {
    const { data } = await admin.from("comments").select("id, user_id, post_id, deleted_at, hidden_at").eq("id", parentId).maybeSingle();
    if (!data || data.post_id !== id || data.deleted_at || data.hidden_at) {
      return NextResponse.json({ error: "invalid_parent" }, { status: 400 });
    }
    parent = data;
  }

  // Task4: 1ユーザーにつき1分間5件まで
  let allowed: boolean;
  try {
    allowed = await isWithinRateLimit(
      admin,
      user.id,
      "comment_create",
      COMMENT_RATE_LIMIT_WINDOW_SECONDS,
      COMMENT_RATE_LIMIT_MAX_ATTEMPTS
    );
  } catch {
    return NextResponse.json({ error: "rate_limit_unavailable" }, { status: 503 });
  }
  if (!allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  // RLS（comments_owner_write）に従わせるためユーザー権限で作成する
  const { data: comment, error } = await supabase
    .from("comments")
    .insert({ post_id: id, user_id: user.id, body: validation.body, parent_id: parentId })
    .select("id, user_id, body, created_at, parent_id, root_id, deleted_at")
    .single();

  if (error || !comment) {
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  // 要件7.5: コメントの投稿
  await recordOperation(admin, {
    actionType: "comment_create",
    userId: user.id,
    targetId: comment.id,
    detail: { postId: id },
  });

  // Task5: 投稿者への通知（自分自身のコメントは createNotification 側で除外）
  await createNotification(admin, {
    recipientId: target.post.user_id,
    actorId: user.id,
    type: "comment",
    relatedId: comment.id,
  });
  // v3.2: 返信先の投稿者への通知（投稿者本人なら上の comment 通知だけにして二重に送らない）
  if (parent && parent.user_id !== target.post.user_id) {
    await createNotification(admin, {
      recipientId: parent.user_id,
      actorId: user.id,
      type: "comment_replied",
      relatedId: comment.id,
    });
  }

  const { data: profile } = await admin
    .from("users")
    .select("display_name, avatar_url, is_deleted")
    .eq("id", user.id)
    .maybeSingle();

  // 「@名前 への返信」用に返信先の名前を付けて返す
  let replyToName: string | null = null;
  if (parent) {
    const { data: parentUser } = await admin.from("users").select("display_name, is_deleted").eq("id", parent.user_id).maybeSingle();
    replyToName = parentUser?.is_deleted ? "退会済みユーザー" : (parentUser?.display_name ?? "ユーザー");
  }
  return NextResponse.json({ comment: toCommentData({ ...comment, users: profile ?? null }, user.id, replyToName) }, { status: 201 });
}
