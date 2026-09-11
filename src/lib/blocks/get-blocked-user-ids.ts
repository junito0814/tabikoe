import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * F-SF-02 Task2: ブロック除外フィルタ
 * 出典: docs/tasks/safety/blocking/02-blocked-content-filter-helper.md
 *       要件定義書3.8.2（相互非表示。共同アルバム内は例外）
 *
 * ## 利用ガイド（他ストーリーの実装者向け）
 *
 * ユーザーに紐づくコンテンツ（投稿・コメント・プロフィール・アルバム・地図のピン）を
 * 取得するクエリでは、この関数の戻り値を `user_id NOT IN (...)` 相当の条件に使う。
 *
 * ```ts
 * const excluded = await getBlockedUserIds(admin, user.id);
 * let query = admin.from("posts").select("...");
 * if (excluded.length > 0) {
 *   query = query.not("user_id", "in", `(${excluded.join(",")})`);
 * }
 * ```
 *
 * ## 方向について
 *
 * 3.8.2は「相互非表示」なので、自分がブロックした相手と、自分をブロックした相手の
 * **両方**を除外する。`blocks` のRLS（blocks_owner_all）は自分が blocker の行しか
 * 見せないため、後者を取るにはService Role Keyのクライアントが必要。
 * この関数はRoute Handler内でのみ呼び、戻り値（誰が自分をブロックしたか）を
 * そのままクライアントへ返さないこと。
 *
 * ## アルバム文脈の例外
 *
 * 共同アルバム内の投稿一覧では、メンバー同士がブロック関係でも相手の投稿を表示する
 * （アルバムの成立を優先。3.8.2）。呼び出し側は `{ albumContext: true }` を渡すと
 * 空配列が返り、フィルタ無しで取得できる。
 */
export interface BlockedUserIdsOptions {
  /** trueならアルバム内の取得として扱い、除外リストを適用しない（3.8.2の例外） */
  albumContext?: boolean;
}

export async function getBlockedUserIds(
  admin: SupabaseClient,
  userId: string,
  options: BlockedUserIdsOptions = {}
): Promise<string[]> {
  if (options.albumContext) {
    return [];
  }

  const { data, error } = await admin
    .from("blocks")
    .select("blocker_id, blocked_id")
    .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);

  if (error) {
    throw error;
  }

  const ids = new Set<string>();
  for (const row of data ?? []) {
    // 自分以外の側がブロック関係の相手
    ids.add(row.blocker_id === userId ? row.blocked_id : row.blocker_id);
  }
  ids.delete(userId);

  return Array.from(ids);
}

/**
 * 2ユーザーがブロック関係にあるか（どちらの方向でも）。
 * プロフィール表示の可否など、単一ユーザーとの関係を判定する場面用。
 */
export async function isBlockedEitherWay(
  admin: SupabaseClient,
  userId: string,
  otherUserId: string
): Promise<boolean> {
  const { data, error } = await admin
    .from("blocks")
    .select("id")
    .or(
      `and(blocker_id.eq.${userId},blocked_id.eq.${otherUserId}),` +
        `and(blocker_id.eq.${otherUserId},blocked_id.eq.${userId})`
    )
    .limit(1);

  if (error) {
    throw error;
  }

  return (data?.length ?? 0) > 0;
}
