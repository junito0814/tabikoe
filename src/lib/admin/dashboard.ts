import type { SupabaseClient } from "@supabase/supabase-js";
import { REPORT_TARGET_LABELS, type ReportTargetType } from "@/lib/reports/constants";

/**
 * admin-shell-dashboard Task 2: ダッシュボード（SC-16）に出す数字を 1 か所で集める
 * 出典: docs/tasks/admin/admin-shell-dashboard/02-dashboard-summary.md
 *       要件定義書 3.10.3「ダッシュボード」
 *
 * 【初心者向け】問い合わせは全部 Promise.all で同時に投げる（往復を直列にしない）。
 * それぞれの結果は「数字だけ」なので `count: "exact", head: true` で行の中身を取らない。
 * 「今週」は日本時間の月曜 0 時から（startOfWeekJst）。純粋関数に切り出してテストする。
 */
export interface AdminDashboardData {
  /** 上段: 対応が要るもの */
  needsAction: {
    openReports: { count: number; oldestDays: number | null };
    autoHiddenPending: number;
    provisionalSuspensions: number;
  };
  /** 中段: 数字 */
  counts: {
    users: { total: number; thisWeek: number };
    posts: { total: number; thisWeek: number };
    spots: { total: number; manual: number };
    /** 最終利用日（users.last_active_at）が今日／今週の人数（admin-shell-dashboard Task 3） */
    activeUsers: { today: number; thisWeek: number } | null;
  };
  /** 下段: 最近の動き */
  recentPosts: RecentPost[];
  recentSpots: RecentSpot[];
  concentratedTargets: ConcentratedTarget[];
}

export interface RecentPost {
  id: string;
  spotName: string;
  authorName: string;
  category: string;
  /** 公開／非公開（visibility が private、または非公開化されている） */
  isPublic: boolean;
  publishedAt: string;
}

export interface RecentSpot {
  id: string;
  name: string;
  prefecture: string | null;
  isManual: boolean;
  createdAt: string;
}

export interface ConcentratedTarget {
  targetType: ReportTargetType;
  targetId: string;
  label: string;
  /** 異なる通報者の数 */
  reporterCount: number;
  latestAt: string;
  /** 通報一覧で絞るためのリンク先 */
  href: string;
}

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 日本時間で「今週の月曜 0 時」を返す（純粋関数） */
export function startOfWeekJst(now: Date): Date {
  const jst = new Date(now.getTime() + JST_OFFSET_MS);
  const day = jst.getUTCDay(); // 0=日 … 6=土
  const daysSinceMonday = (day + 6) % 7;
  const mondayJst = Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate() - daysSinceMonday);
  return new Date(mondayJst - JST_OFFSET_MS);
}

/** 日本時間で「今日の 0 時」を返す（純粋関数） */
export function startOfDayJst(now: Date): Date {
  const jst = new Date(now.getTime() + JST_OFFSET_MS);
  return new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate()) - JST_OFFSET_MS);
}

/** 経過日数（切り捨て。未来なら 0） */
export function daysSince(iso: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 86400000));
}

/**
 * 未処理の通報 → 対象ごとの「異なる通報者の数」。多い順、同数なら新しい順（純粋関数）。
 * 同じ人が同じ対象を 2 回通報することは unique 制約で起きないが、念のため Set で畳む。
 */
export function groupConcentratedTargets(
  reports: readonly { targetType: ReportTargetType; targetId: string; reporterId: string; createdAt: string }[],
  labels: ReadonlyMap<string, string>,
  limit = 5
): ConcentratedTarget[] {
  const groups = new Map<string, { targetType: ReportTargetType; targetId: string; reporters: Set<string>; latestAt: string }>();
  for (const r of reports) {
    const key = `${r.targetType}:${r.targetId}`;
    const g = groups.get(key) ?? { targetType: r.targetType, targetId: r.targetId, reporters: new Set<string>(), latestAt: r.createdAt };
    g.reporters.add(r.reporterId);
    if (r.createdAt > g.latestAt) g.latestAt = r.createdAt;
    groups.set(key, g);
  }
  return [...groups.values()]
    .sort((a, b) => b.reporters.size - a.reporters.size || b.latestAt.localeCompare(a.latestAt))
    .slice(0, limit)
    .map((g) => ({
      targetType: g.targetType,
      targetId: g.targetId,
      label: labels.get(`${g.targetType}:${g.targetId}`) ?? `${REPORT_TARGET_LABELS[g.targetType]} ${g.targetId.slice(0, 8)}`,
      reporterCount: g.reporters.size,
      latestAt: g.latestAt,
      href: `/admin/reports?status=open&target_type=${g.targetType}&target_id=${g.targetId}`,
    }));
}

const OPEN_STATUSES = ["unconfirmed", "in_review"];

export async function loadAdminDashboard(admin: SupabaseClient, now: Date = new Date()): Promise<AdminDashboardData> {
  const weekStart = startOfWeekJst(now).toISOString();
  const dayStart = startOfDayJst(now).toISOString();
  // 【初心者向け】`select("id", { count: "exact", head: true })` は「件数だけ数えて、行は返さない」
  const counting = (table: string) => admin.from(table).select("id", { count: "exact", head: true });

  const [
    openReports,
    oldestReport,
    provisional,
    usersTotal,
    usersWeek,
    postsTotal,
    postsWeek,
    spotsTotal,
    spotsManual,
    activeToday,
    activeWeek,
    autoHiddenPosts,
    autoHiddenComments,
    recentPosts,
    recentSpots,
    openReportRows,
  ] = await Promise.all([
    counting("reports").in("status", OPEN_STATUSES),
    admin.from("reports").select("created_at").in("status", OPEN_STATUSES).order("created_at", { ascending: true }).limit(1).maybeSingle(),
    counting("users").eq("suspension_kind", "provisional"),
    counting("users").eq("is_deleted", false),
    counting("users").eq("is_deleted", false).gte("created_at", weekStart),
    counting("posts").eq("status", "published"),
    counting("posts").eq("status", "published").gte("published_at", weekStart),
    counting("spots"),
    counting("spots").eq("source", "manual"),
    counting("users").gte("last_active_at", dayStart),
    counting("users").gte("last_active_at", weekStart),
    counting("posts").eq("hidden_reason", "auto"),
    counting("comments").eq("hidden_reason", "auto"),
    admin
      .from("posts")
      .select("id, category, visibility, hidden_at, published_at, spots(name), users(display_name)")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(5),
    admin.from("spots").select("id, name, prefecture, source, created_at").order("created_at", { ascending: false }).limit(5),
    admin.from("reports").select("target_type, target_id, reporter_id, created_at").in("status", OPEN_STATUSES),
  ]);

  const one = <T>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

  const posts: RecentPost[] = (recentPosts.data ?? []).map((row) => ({
    id: row.id as string,
    spotName: one(row.spots as { name: string } | { name: string }[] | null)?.name ?? "（スポットなし）",
    authorName: one(row.users as { display_name: string | null } | { display_name: string | null }[] | null)?.display_name ?? "（名前なし）",
    category: row.category as string,
    isPublic: row.visibility === "public" && !row.hidden_at,
    publishedAt: (row.published_at as string | null) ?? "",
  }));

  const spots: RecentSpot[] = (recentSpots.data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    prefecture: (row.prefecture as string | null) ?? null,
    isManual: row.source === "manual",
    createdAt: row.created_at as string,
  }));

  const rows = (openReportRows.data ?? []).map((r) => ({
    targetType: r.target_type as ReportTargetType,
    targetId: r.target_id as string,
    reporterId: r.reporter_id as string,
    createdAt: r.created_at as string,
  }));
  const labels = await resolveTargetLabels(admin, rows);

  return {
    needsAction: {
      openReports: { count: openReports.count ?? 0, oldestDays: oldestReport.data?.created_at ? daysSince(oldestReport.data.created_at as string, now) : null },
      // strike-system Task 3: 自動で隠れたまま（hidden_reason = auto）の投稿・コメント
      autoHiddenPending: (autoHiddenPosts.count ?? 0) + (autoHiddenComments.count ?? 0),
      provisionalSuspensions: provisional.count ?? 0,
    },
    counts: {
      users: { total: usersTotal.count ?? 0, thisWeek: usersWeek.count ?? 0 },
      posts: { total: postsTotal.count ?? 0, thisWeek: postsWeek.count ?? 0 },
      spots: { total: spotsTotal.count ?? 0, manual: spotsManual.count ?? 0 },
      activeUsers: { today: activeToday.count ?? 0, thisWeek: activeWeek.count ?? 0 },
    },
    recentPosts: posts,
    recentSpots: spots,
    concentratedTargets: groupConcentratedTargets(rows, labels),
  };
}

/** 通報が集中している対象の言い方（投稿はスポット名、ユーザーは表示名。他は種別だけ） */
async function resolveTargetLabels(
  admin: SupabaseClient,
  rows: readonly { targetType: ReportTargetType; targetId: string }[]
): Promise<Map<string, string>> {
  const labels = new Map<string, string>();
  const postIds = [...new Set(rows.filter((r) => r.targetType === "post" || r.targetType === "post_review" || r.targetType === "post_photo").map((r) => r.targetId))];
  const userIds = [...new Set(rows.filter((r) => r.targetType === "user").map((r) => r.targetId))];
  const [posts, users] = await Promise.all([
    postIds.length > 0 ? admin.from("posts").select("id, spots(name)").in("id", postIds) : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    userIds.length > 0 ? admin.from("users").select("id, display_name").in("id", userIds) : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);
  const spotNameByPost = new Map(
    (posts.data ?? []).map((p) => {
      const spot = p.spots as { name: string } | { name: string }[] | null;
      return [p.id as string, (Array.isArray(spot) ? spot[0]?.name : spot?.name) ?? ""];
    })
  );
  const nameByUser = new Map((users.data ?? []).map((u) => [u.id as string, (u.display_name as string | null) ?? ""]));
  for (const r of rows) {
    const key = `${r.targetType}:${r.targetId}`;
    if (labels.has(key)) continue;
    const base = REPORT_TARGET_LABELS[r.targetType];
    if (r.targetType === "user") labels.set(key, `${nameByUser.get(r.targetId) || base}（ユーザー）`);
    else if (r.targetType === "post" || r.targetType === "post_review" || r.targetType === "post_photo") {
      const spot = spotNameByPost.get(r.targetId);
      labels.set(key, spot ? `${spot}の${base}` : base);
    }
  }
  return labels;
}
