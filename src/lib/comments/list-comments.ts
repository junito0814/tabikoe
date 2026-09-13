import type { SupabaseClient } from "@supabase/supabase-js";
import { getBlockedUserIds } from "@/lib/blocks/get-blocked-user-ids";
import { DEACTIVATED_DISPLAY_NAME, DEFAULT_AVATAR_URL } from "@/lib/users/constants";
import { COMMENTS_PAGE_SIZE } from "./constants";
import { unescapeHtml } from "./validate-comment";

/**
 * F-VW-03 Task3: コメント一覧（新着順・20件ページング）
 * 出典: docs/tasks/browsing/comments/03-comment-list-handler.md
 */
export interface CommentData {
  id: string;
  /** 表示用の本文（保存時のエスケープを戻したもの。描画は React のテキストノードで行う） */
  body: string;
  createdAt: string;
  author: { id: string; displayName: string; avatarUrl: string; isDeleted: boolean };
  /** 閲覧者自身のコメントか（削除ボタンの表示に使う） */
  isMine: boolean;
}

export interface CommentPage {
  comments: CommentData[];
  nextOffset: number | null;
  totalCount: number;
}

export interface CommentRow {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  users:
    | { display_name: string | null; avatar_url: string | null; is_deleted: boolean }
    | { display_name: string | null; avatar_url: string | null; is_deleted: boolean }[]
    | null;
}

export function toCommentData(row: CommentRow, viewerId: string): CommentData {
  const user = Array.isArray(row.users) ? row.users[0] : row.users;
  const isDeleted = user?.is_deleted ?? false;
  return {
    id: row.id,
    body: unescapeHtml(row.body),
    createdAt: row.created_at,
    author: {
      id: row.user_id,
      displayName: isDeleted ? DEACTIVATED_DISPLAY_NAME : (user?.display_name ?? "ユーザー"),
      avatarUrl: isDeleted ? DEFAULT_AVATAR_URL : (user?.avatar_url ?? DEFAULT_AVATAR_URL),
      isDeleted,
    },
    isMine: row.user_id === viewerId,
  };
}

/**
 * ページング結果を組み立てる。`totalCount` は絞り込み後の総件数。単体テストの対象。
 */
export function buildCommentPage(
  rows: CommentRow[],
  viewerId: string,
  offset: number,
  totalCount: number
): CommentPage {
  return {
    comments: rows.map((row) => toCommentData(row, viewerId)),
    nextOffset: offset + rows.length < totalCount ? offset + rows.length : null,
    totalCount,
  };
}

/** 投稿のコメントを新着順に1ページ返す。ブロック関係のユーザーのコメントは除く（3.8.2） */
export async function listComments(
  admin: SupabaseClient,
  viewerId: string,
  postId: string,
  offset: number,
  limit: number = COMMENTS_PAGE_SIZE
): Promise<CommentPage> {
  const blockedIds = await getBlockedUserIds(admin, viewerId);

  let query = admin
    .from("comments")
    .select("id, user_id, body, created_at, users(display_name, avatar_url, is_deleted)", { count: "exact" })
    .eq("post_id", postId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (blockedIds.length > 0) {
    query = query.not("user_id", "in", `(${blockedIds.join(",")})`);
  }

  const { data, error, count } = await query;
  if (error) throw error;

  return buildCommentPage((data ?? []) as unknown as CommentRow[], viewerId, offset, count ?? 0);
}
