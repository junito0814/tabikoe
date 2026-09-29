import type { SupabaseClient } from "@supabase/supabase-js";
import { activeStrikeCount, isPostingRestricted, type StrikeLike } from "@/lib/moderation/strike-rules";

/**
 * user-management Task 1: 利用者一覧（SC-24）の判断と取得
 * 出典: docs/tasks/admin/user-management/01-user-list.md
 *       要件定義書 3.10.9「利用者の管理」
 *
 * 【初心者向け】「この人はいまどういう状態か」は suspended_at / suspension_kind / posting_restricted_until の
 * 3 列から決まる。決め方は userStatusOf() に閉じ込め、一覧・詳細・絞り込みが同じ答えを使う。
 * 一覧の各行に付ける数字（投稿数・通報された回数・有効なストライク）は、そのページの 20 人分だけまとめて取る。
 */
export type UserStatus = "normal" | "restricted" | "provisional" | "suspended";

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  normal: "通常",
  restricted: "投稿禁止中",
  provisional: "仮停止（確認待ち）",
  suspended: "停止",
};

export interface UserStatusSource {
  suspendedAt: string | null;
  suspensionKind: "provisional" | "confirmed" | null;
  postingRestrictedUntil: string | null;
}

/** 状態を 1 語にする（純粋関数） */
export function userStatusOf(user: UserStatusSource, now: Date): UserStatus {
  if (user.suspendedAt) return user.suspensionKind === "provisional" ? "provisional" : "suspended";
  if (isPostingRestricted(user.postingRestrictedUntil, now)) return "restricted";
  return "normal";
}

export const USER_SORTS = ["last_active", "created", "reported"] as const;
export type UserSort = (typeof USER_SORTS)[number];
export const USER_SORT_LABELS: Record<UserSort, string> = {
  last_active: "最終利用が新しい順",
  created: "登録が新しい順",
  reported: "通報された回数が多い順（このページ内）",
};

export const ADMIN_USERS_PAGE_SIZE = 20;

export interface UserListQuery {
  /** 表示名・メールの部分一致 */
  q: string;
  status: UserStatus | null;
  sort: UserSort;
  offset: number;
}

/** クエリ文字列 → 条件（不正な値は既定に。純粋関数） */
export function parseUserListQuery(params: URLSearchParams): UserListQuery {
  const status = params.get("status") ?? "";
  const sort = params.get("sort") ?? "";
  return {
    q: (params.get("q") ?? "").trim().slice(0, 100),
    status: status in USER_STATUS_LABELS ? (status as UserStatus) : null,
    sort: (USER_SORTS as readonly string[]).includes(sort) ? (sort as UserSort) : "last_active",
    offset: Math.max(0, Number.parseInt(params.get("offset") ?? "0", 10) || 0),
  };
}

export function buildUserListParams(query: Partial<UserListQuery>): URLSearchParams {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.status) params.set("status", query.status);
  if (query.sort && query.sort !== "last_active") params.set("sort", query.sort);
  if (query.offset) params.set("offset", String(query.offset));
  return params;
}

export interface AdminUserRow {
  id: string;
  displayName: string;
  email: string;
  createdAt: string;
  lastActiveAt: string | null;
  postCount: number;
  reportedCount: number;
  activeStrikes: number;
  status: UserStatus;
  /** 投稿禁止の解除日時（restricted のとき） */
  postingRestrictedUntil: string | null;
}

/** ilike 用のエスケープ（% _ \ をそのまま文字として探す） */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export async function listAdminUsers(
  admin: SupabaseClient,
  query: UserListQuery,
  now: Date = new Date()
): Promise<{ users: AdminUserRow[]; nextOffset: number | null }> {
  let request = admin
    .from("users")
    .select("id, display_name, email, created_at, last_active_at, suspended_at, suspension_kind, posting_restricted_until", { count: "exact" })
    .eq("is_deleted", false);

  if (query.q) {
    const like = `%${escapeLike(query.q)}%`;
    request = request.or(`display_name.ilike.${like},email.ilike.${like}`);
  }
  const nowIso = now.toISOString();
  switch (query.status) {
    case "provisional":
      request = request.eq("suspension_kind", "provisional").not("suspended_at", "is", null);
      break;
    case "suspended":
      request = request.not("suspended_at", "is", null).neq("suspension_kind", "provisional");
      break;
    case "restricted":
      request = request.is("suspended_at", null).gt("posting_restricted_until", nowIso);
      break;
    case "normal":
      request = request.is("suspended_at", null).or(`posting_restricted_until.is.null,posting_restricted_until.lte.${nowIso}`);
      break;
  }
  request =
    query.sort === "created"
      ? request.order("created_at", { ascending: false })
      : request.order("last_active_at", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
  request = request.range(query.offset, query.offset + ADMIN_USERS_PAGE_SIZE - 1);

  const { data, error, count } = await request;
  if (error) throw error;
  const rows = (data ?? []) as {
    id: string;
    display_name: string | null;
    email: string;
    created_at: string;
    last_active_at: string | null;
    suspended_at: string | null;
    suspension_kind: "provisional" | "confirmed" | null;
    posting_restricted_until: string | null;
  }[];
  const ids = rows.map((r) => r.id);
  const stats = await loadUserStats(admin, ids, now);

  let users: AdminUserRow[] = rows.map((r) => ({
    id: r.id,
    displayName: r.display_name ?? "（名前なし）",
    email: r.email,
    createdAt: r.created_at,
    lastActiveAt: r.last_active_at,
    postCount: stats.postCount.get(r.id) ?? 0,
    reportedCount: stats.reportedCount.get(r.id) ?? 0,
    activeStrikes: stats.activeStrikes.get(r.id) ?? 0,
    status: userStatusOf({ suspendedAt: r.suspended_at, suspensionKind: r.suspension_kind, postingRestrictedUntil: r.posting_restricted_until }, now),
    postingRestrictedUntil: r.posting_restricted_until,
  }));
  // 通報された回数は集計値なので DB では並べられない。取ったページの中で並べ替える
  if (query.sort === "reported") users = [...users].sort((a, b) => b.reportedCount - a.reportedCount);

  const total = count ?? 0;
  return { users, nextOffset: query.offset + rows.length < total ? query.offset + rows.length : null };
}

/**
 * ページ内の利用者の 投稿数／通報された回数／有効なストライク数。
 * 「通報された」は、本人への通報＋本人の投稿・コメントへの通報を合わせる。
 */
export async function loadUserStats(
  admin: SupabaseClient,
  userIds: readonly string[],
  now: Date
): Promise<{ postCount: Map<string, number>; reportedCount: Map<string, number>; activeStrikes: Map<string, number> }> {
  const postCount = new Map<string, number>();
  const reportedCount = new Map<string, number>();
  const activeStrikes = new Map<string, number>();
  if (userIds.length === 0) return { postCount, reportedCount, activeStrikes };
  const ids = [...userIds];

  const [posts, comments, strikes] = await Promise.all([
    admin.from("posts").select("id, user_id, status").in("user_id", ids),
    admin.from("comments").select("id, user_id").in("user_id", ids),
    admin.from("strikes").select("user_id, created_at, expires_at, revoked_at").in("user_id", ids),
  ]);
  if (posts.error) throw posts.error;
  if (comments.error) throw comments.error;
  if (strikes.error) throw strikes.error;

  const ownerOf = new Map<string, string>(); // 投稿 ID／コメント ID → 持ち主
  for (const p of (posts.data ?? []) as { id: string; user_id: string; status: string }[]) {
    ownerOf.set(p.id, p.user_id);
    if (p.status === "published") postCount.set(p.user_id, (postCount.get(p.user_id) ?? 0) + 1);
  }
  for (const c of (comments.data ?? []) as { id: string; user_id: string }[]) ownerOf.set(c.id, c.user_id);

  const targetIds = [...ownerOf.keys(), ...ids];
  const reports = await admin.from("reports").select("target_type, target_id").in("target_id", targetIds);
  if (reports.error) throw reports.error;
  for (const r of (reports.data ?? []) as { target_type: string; target_id: string }[]) {
    const owner = r.target_type === "user" ? r.target_id : ownerOf.get(r.target_id);
    if (owner) reportedCount.set(owner, (reportedCount.get(owner) ?? 0) + 1);
  }

  const byUser = new Map<string, StrikeLike[]>();
  for (const s of (strikes.data ?? []) as { user_id: string; created_at: string; expires_at: string; revoked_at: string | null }[]) {
    const list = byUser.get(s.user_id) ?? [];
    list.push({ createdAt: s.created_at, expiresAt: s.expires_at, revokedAt: s.revoked_at });
    byUser.set(s.user_id, list);
  }
  for (const [userId, list] of byUser) activeStrikes.set(userId, activeStrikeCount(list, now));

  return { postCount, reportedCount, activeStrikes };
}
