import type { SupabaseClient } from "@supabase/supabase-js";
import { getBlockedUserIds } from "@/lib/blocks/get-blocked-user-ids";
import { DEFAULT_AVATAR_URL } from "@/lib/users/constants";

/**
 * feedback-0919 Task6（v3.2）: ユーザー名の検索（アプリ内招待の相手を探す）
 * 出典: docs/tasks/shared-ui/feedback-0919/06-in-app-invite.md
 *       要件定義書 v3.2 3.6.3「アプリ内招待」（2 文字以上、最大 20 件）、7.3（1 分 30 回）
 *
 * 【初心者向け】表示名の部分一致で探す。自分・退会済み・ブロック関係（どちら向きも）は出さない。
 */
export const USER_SEARCH_MIN_LENGTH = 2;
export const USER_SEARCH_LIMIT = 20;

export interface UserSummary {
  id: string;
  displayName: string;
  avatarUrl: string;
}

export function normalizeUserQuery(raw: string | null | undefined): string | null {
  const q = (raw ?? "").trim();
  return q.length >= USER_SEARCH_MIN_LENGTH ? q : null;
}

export async function searchUsersByName(admin: SupabaseClient, viewerId: string, query: string): Promise<UserSummary[]> {
  const blockedIds = await getBlockedUserIds(admin, viewerId);
  const escaped = query.replace(/[\\%_]/g, (char) => `\\${char}`);
  let request = admin
    .from("users")
    .select("id, display_name, avatar_url")
    .ilike("display_name", `%${escaped}%`)
    .eq("is_deleted", false)
    .neq("id", viewerId)
    .order("display_name", { ascending: true })
    .limit(USER_SEARCH_LIMIT);
  if (blockedIds.length > 0) request = request.not("id", "in", `(${blockedIds.join(",")})`);
  const { data, error } = await request;
  if (error) throw error;
  return ((data ?? []) as { id: string; display_name: string | null; avatar_url: string | null }[]).map(toUserSummary);
}

export function toUserSummary(row: { id: string; display_name: string | null; avatar_url: string | null }): UserSummary {
  return { id: row.id, displayName: row.display_name ?? "ユーザー", avatarUrl: row.avatar_url ?? DEFAULT_AVATAR_URL };
}
