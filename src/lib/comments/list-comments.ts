import type { SupabaseClient } from "@supabase/supabase-js";
import { getBlockedUserIds } from "@/lib/blocks/get-blocked-user-ids";
import { DEACTIVATED_DISPLAY_NAME, DEFAULT_AVATAR_URL } from "@/lib/users/constants";
import { COMMENTS_PAGE_SIZE } from "./constants";
import { unescapeHtml } from "./validate-comment";

/**
 * F-VW-03 Task3 / feedback-0919 Task4（v3.2）: コメント一覧（新着順・20件ページング・返信つき）
 * 出典: docs/tasks/browsing/comments/03-comment-list-handler.md
 *       docs/tasks/shared-ui/feedback-0919/04-comment-reply.md
 *       要件定義書 v3.2 3.5.3「返信の表示」
 *
 * 【初心者向け】v3.2 で返信が付いた。1 ページは「最上位のコメント 20 件」で、それぞれの `replies` に
 * その下の返信（返信への返信も同じ段）を時系列（古い順）で全部入れる。件数（totalCount）は返信も数える。
 * 返信がある親を削除すると `deleted: true` の枠だけ残る（本文・投稿者は伏せる）。
 */
export interface CommentData {
  id: string;
  /** 表示用の本文（保存時のエスケープを戻したもの。描画は React のテキストノードで行う） */
  body: string;
  createdAt: string;
  author: { id: string; displayName: string; avatarUrl: string; isDeleted: boolean };
  /** 閲覧者自身のコメントか（削除ボタンの表示に使う） */
  isMine: boolean;
  /** v3.2: 返信先のコメント（最上位なら null） */
  parentId: string | null;
  /** v3.2: 「@名前 への返信」に出す返信先の投稿者名（返信先が消えていれば null） */
  replyToName: string | null;
  /** v3.2: 返信がある親を削除したあとの枠（本文・投稿者は出さない） */
  deleted: boolean;
  /** v3.2: 最上位のコメントだけ持つ。返信（返信への返信も含む）を古い順に */
  replies: CommentData[];
}

export interface CommentPage {
  comments: CommentData[];
  nextOffset: number | null;
  /** 返信を含む総件数 */
  totalCount: number;
  /**
   * #885: 見ている人（これから書く人）のアイコン。入力欄の左に出す。
   *
   * 【初心者向け】なぜ `CommentPage` に入れるのか。別の props にすると、コメント欄を描く
   * すべての画面（投稿詳細・スポット別一覧・みんなの投稿・近くのコエ・マイページ・アルバム）に
   * **同じものを渡して回る**ことになる。1 ページ目を取るときに一緒に返せば、受け取る側は
   * 今までどおり `initialPage` を渡すだけで済む。取れなくても画面は出す（既定のアイコンにする）。
   */
  viewerAvatarUrl: string | null;
}

export interface CommentRow {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  parent_id?: string | null;
  root_id?: string | null;
  deleted_at?: string | null;
  users:
    | { display_name: string | null; avatar_url: string | null; is_deleted: boolean }
    | { display_name: string | null; avatar_url: string | null; is_deleted: boolean }[]
    | null;
}

function authorOf(row: CommentRow): CommentData["author"] {
  const user = Array.isArray(row.users) ? row.users[0] : row.users;
  const isDeleted = user?.is_deleted ?? false;
  return {
    id: row.user_id,
    displayName: isDeleted ? DEACTIVATED_DISPLAY_NAME : (user?.display_name ?? "ユーザー"),
    avatarUrl: isDeleted ? DEFAULT_AVATAR_URL : (user?.avatar_url ?? DEFAULT_AVATAR_URL),
    isDeleted,
  };
}

export function toCommentData(row: CommentRow, viewerId: string, replyToName: string | null = null): CommentData {
  const deleted = Boolean(row.deleted_at);
  return {
    id: row.id,
    body: deleted ? "" : unescapeHtml(row.body),
    createdAt: row.created_at,
    author: deleted ? { id: "", displayName: "削除されたコメント", avatarUrl: DEFAULT_AVATAR_URL, isDeleted: true } : authorOf(row),
    isMine: !deleted && row.user_id === viewerId,
    parentId: row.parent_id ?? null,
    replyToName,
    deleted,
    replies: [],
  };
}

/**
 * v3.2: 最上位の行と返信の行から、返信をぶら下げた一覧を組み立てる（純粋関数）。
 * 返信は root_id で親にまとめ、古い順に並べる。「@名前 への返信」は同じやり取りの中の行から名前を引く。
 */
export function buildCommentTree(topRows: CommentRow[], replyRows: CommentRow[], viewerId: string): CommentData[] {
  const nameOf = new Map<string, string>();
  for (const row of [...topRows, ...replyRows]) nameOf.set(row.id, row.deleted_at ? "削除されたコメント" : authorOf(row).displayName);
  const repliesByRoot = new Map<string, CommentRow[]>();
  for (const row of replyRows) {
    const root = row.root_id ?? row.parent_id ?? "";
    const list = repliesByRoot.get(root) ?? [];
    list.push(row);
    repliesByRoot.set(root, list);
  }
  return topRows.map((row) => ({
    ...toCommentData(row, viewerId),
    replies: [...(repliesByRoot.get(row.id) ?? [])]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((reply) => toCommentData(reply, viewerId, reply.parent_id ? (nameOf.get(reply.parent_id) ?? null) : null)),
  }));
}

/**
 * ページング結果を組み立てる。`totalCount` は絞り込み後の総件数（返信を含む）。単体テストの対象。
 */
export function buildCommentPage(
  topRows: CommentRow[],
  viewerId: string,
  offset: number,
  totalTopCount: number,
  totalCount: number,
  replyRows: CommentRow[] = [],
  /** #885: 見ている人のアイコン。取れなければ null（画面側で既定のアイコンにする） */
  viewerAvatarUrl: string | null = null
): CommentPage {
  return {
    comments: buildCommentTree(topRows, replyRows, viewerId),
    nextOffset: offset + topRows.length < totalTopCount ? offset + topRows.length : null,
    totalCount,
    viewerAvatarUrl,
  };
}

const COMMENT_SELECT = "id, user_id, body, created_at, parent_id, root_id, deleted_at, users(display_name, avatar_url, is_deleted)";

/** 投稿のコメントを新着順に 1 ページ（最上位 20 件＋返信）返す。ブロック関係のユーザーのコメントは除く（3.8.2） */
export async function listComments(
  admin: SupabaseClient,
  viewerId: string,
  postId: string,
  offset: number,
  limit: number = COMMENTS_PAGE_SIZE
): Promise<CommentPage> {
  const blockedIds = await getBlockedUserIds(admin, viewerId);
  const excludeBlocked = <Q extends { not: (column: string, op: string, value: string) => Q }>(query: Q): Q =>
    blockedIds.length > 0 ? query.not("user_id", "in", `(${blockedIds.join(",")})`) : query;

  // 最上位: parent_id が NULL。削除済みの親（deleted_at あり）も枠として返す
  const topQuery = excludeBlocked(
    admin
      .from("comments")
      .select(COMMENT_SELECT, { count: "exact" })
      .eq("post_id", postId)
      .is("parent_id", null)
      // F-AD-05: 非公開化されたコメントは除く
      .is("hidden_at", null)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)
  );
  // #885: 見ている人のアイコンも一緒に取る（入力欄の左に出す）。並列なので往復は増えない
  const [topResult, totalResult, viewerResult] = await Promise.all([
    topQuery,
    // 返信を含む総件数（削除済みの枠は数えない）
    excludeBlocked(admin.from("comments").select("id", { count: "exact", head: true }).eq("post_id", postId).is("hidden_at", null).is("deleted_at", null)),
    admin.from("users").select("avatar_url").eq("id", viewerId).maybeSingle(),
  ]);
  if (topResult.error) throw topResult.error;
  const topRows = (topResult.data ?? []) as unknown as CommentRow[];

  let replyRows: CommentRow[] = [];
  if (topRows.length > 0) {
    const replyResult = await excludeBlocked(
      admin
        .from("comments")
        .select(COMMENT_SELECT)
        .in(
          "root_id",
          topRows.map((row) => row.id)
        )
        .is("hidden_at", null)
        .order("created_at", { ascending: true })
    );
    if (replyResult.error) throw replyResult.error;
    replyRows = (replyResult.data ?? []) as unknown as CommentRow[];
  }

  const viewerAvatarUrl = (viewerResult.data as { avatar_url?: string | null } | null)?.avatar_url ?? null;
  return buildCommentPage(topRows, viewerId, offset, topResult.count ?? 0, totalResult.count ?? 0, replyRows, viewerAvatarUrl);
}
