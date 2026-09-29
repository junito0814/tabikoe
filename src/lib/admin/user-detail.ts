import type { SupabaseClient } from "@supabase/supabase-js";
import { REPORT_REASON_LABELS, REPORT_TARGET_LABELS, type ReportReason, type ReportTargetType } from "@/lib/reports/constants";
import { REPORT_STATUS_LABELS, type ReportStatus } from "@/lib/admin/report-filters";
import { loadModerationSettings } from "@/lib/moderation/settings";
import { activeStrikes, describeMeasure, measureForStrikeCount, type ModerationSettings } from "@/lib/moderation/strike-rules";
import { ADMIN_ACTION_LABELS, type AdminActionType } from "@/lib/admin/admin-actions";
import { userStatusOf, type UserStatus } from "./users";

/**
 * user-management Task 2: 利用者詳細（SC-24 詳細）に出すものを 1 か所で集める
 * 出典: docs/tasks/admin/user-management/02-user-detail-actions.md
 *       docs/wireframes.md「SC-24 利用者詳細」
 */
export interface AdminUserDetail {
  id: string;
  displayName: string;
  email: string;
  createdAt: string;
  lastActiveAt: string | null;
  status: UserStatus;
  suspendedAt: string | null;
  postingRestrictedUntil: string | null;
  counts: { posts: number; comments: number; reported: number };
  strikes: StrikeRow[];
  activeStrikeCount: number;
  strikesToSuspend: number;
  /** 次のストライクで起きること（例: 7日間 投稿・コメント禁止） */
  nextMeasure: string;
  posts: { id: string; spotName: string; category: string; isPublic: boolean; publishedAt: string | null }[];
  comments: { id: string; postId: string; body: string; createdAt: string; isHidden: boolean }[];
  reportsAgainst: { id: string; targetLabel: string; reasonLabel: string; statusLabel: string; createdAt: string }[];
  actionsOn: { id: string; actorName: string; actionLabel: string; note: string | null; createdAt: string }[];
}

export interface StrikeRow {
  id: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  reasonLabel: string;
  actionLabel: string;
  targetLabel: string | null;
  /** active＝有効、expired＝90 日経過、revoked＝取り消し */
  state: "active" | "expired" | "revoked";
}

export async function getAdminUserDetail(admin: SupabaseClient, userId: string, now: Date = new Date()): Promise<AdminUserDetail | null> {
  const { data: user, error } = await admin
    .from("users")
    .select("id, display_name, email, created_at, last_active_at, suspended_at, suspension_kind, posting_restricted_until, is_deleted")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!user) return null;

  const [strikes, posts, comments, actions, settings] = await Promise.all([
    admin.from("strikes").select("id, created_at, expires_at, revoked_at, reason, action, target_label").eq("user_id", userId).order("created_at", { ascending: false }),
    admin.from("posts").select("id, category, visibility, hidden_at, published_at, status, spots(name)").eq("user_id", userId).order("created_at", { ascending: false }),
    admin.from("comments").select("id, post_id, body, created_at, hidden_at").eq("user_id", userId).order("created_at", { ascending: false }),
    admin.from("admin_actions").select("id, actor_id, action, note, created_at, actor:users(display_name)").eq("target_type", "user").eq("target_id", userId).order("created_at", { ascending: false }).limit(20),
    loadModerationSettings(admin),
  ]);
  if (strikes.error) throw strikes.error;
  if (posts.error) throw posts.error;
  if (comments.error) throw comments.error;
  if (actions.error) throw actions.error;

  const postRows = (posts.data ?? []) as { id: string; category: string; visibility: string; hidden_at: string | null; published_at: string | null; status: string; spots: { name: string } | { name: string }[] | null }[];
  const commentRows = (comments.data ?? []) as { id: string; post_id: string; body: string; created_at: string; hidden_at: string | null }[];
  const reportsAgainst = await loadReportsAgainst(admin, userId, postRows.map((p) => p.id), commentRows.map((c) => c.id));

  const strikeRows: StrikeRow[] = ((strikes.data ?? []) as { id: string; created_at: string; expires_at: string; revoked_at: string | null; reason: string; action: string; target_label: string | null }[]).map((s) => ({
    id: s.id,
    createdAt: s.created_at,
    expiresAt: s.expires_at,
    revokedAt: s.revoked_at,
    reasonLabel: REPORT_REASON_LABELS[s.reason as ReportReason] ?? s.reason,
    actionLabel: s.action === "delete" ? "削除" : "非公開化",
    targetLabel: s.target_label,
    state: s.revoked_at ? "revoked" : new Date(s.expires_at).getTime() > now.getTime() ? "active" : "expired",
  }));
  const active = activeStrikes(strikeRows.map((s) => ({ createdAt: s.createdAt, expiresAt: s.expiresAt, revokedAt: s.revokedAt })), now).length;

  const one = <T>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));
  return {
    id: user.id as string,
    displayName: (user.display_name as string | null) ?? "（名前なし）",
    email: user.email as string,
    createdAt: user.created_at as string,
    lastActiveAt: (user.last_active_at as string | null) ?? null,
    status: userStatusOf({ suspendedAt: user.suspended_at as string | null, suspensionKind: user.suspension_kind as "provisional" | "confirmed" | null, postingRestrictedUntil: user.posting_restricted_until as string | null }, now),
    suspendedAt: (user.suspended_at as string | null) ?? null,
    postingRestrictedUntil: (user.posting_restricted_until as string | null) ?? null,
    counts: { posts: postRows.filter((p) => p.status === "published").length, comments: commentRows.length, reported: reportsAgainst.length },
    strikes: strikeRows,
    activeStrikeCount: active,
    strikesToSuspend: settings.strikesToSuspend,
    nextMeasure: nextMeasureLabel(active, settings),
    posts: postRows
      .filter((p) => p.status === "published")
      .slice(0, 20)
      .map((p) => ({ id: p.id, spotName: one(p.spots)?.name ?? "（スポットなし）", category: p.category, isPublic: p.visibility === "public" && !p.hidden_at, publishedAt: p.published_at })),
    comments: commentRows.slice(0, 20).map((c) => ({ id: c.id, postId: c.post_id, body: c.body, createdAt: c.created_at, isHidden: !!c.hidden_at })),
    reportsAgainst,
    actionsOn: ((actions.data ?? []) as { id: string; actor_id: string | null; action: string; note: string | null; created_at: string; actor: { display_name: string | null } | { display_name: string | null }[] | null }[]).map((a) => ({
      id: a.id,
      actorName: a.actor_id ? (one(a.actor)?.display_name ?? "（退会済み）") : "自動",
      actionLabel: ADMIN_ACTION_LABELS[a.action as AdminActionType] ?? a.action,
      note: a.note,
      createdAt: a.created_at,
    })),
  };
}

/** 次のストライクで起きることの文言（純粋関数） */
export function nextMeasureLabel(activeCount: number, settings: ModerationSettings): string {
  return describeMeasure(measureForStrikeCount(activeCount + 1, settings));
}

/** 本人・本人の投稿・コメントへの通報 */
async function loadReportsAgainst(admin: SupabaseClient, userId: string, postIds: string[], commentIds: string[]) {
  const targetIds = [userId, ...postIds, ...commentIds];
  const { data, error } = await admin
    .from("reports")
    .select("id, target_type, target_id, reason, status, created_at")
    .in("target_id", targetIds)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as { id: string; target_type: string; target_id: string; reason: string; status: string; created_at: string }[])
    .filter((r) => (r.target_type === "user" ? r.target_id === userId : true))
    .map((r) => ({
      id: r.id,
      targetLabel: REPORT_TARGET_LABELS[r.target_type as ReportTargetType] ?? r.target_type,
      reasonLabel: REPORT_REASON_LABELS[r.reason as ReportReason] ?? r.reason,
      statusLabel: REPORT_STATUS_LABELS[r.status as ReportStatus] ?? r.status,
      createdAt: r.created_at,
    }));
}
