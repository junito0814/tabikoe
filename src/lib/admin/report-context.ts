import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReportDetail } from "./report-detail";
import { loadModerationSettings } from "@/lib/moderation/settings";
import { activeStrikeCount, describeMeasure, isSevereReason, measureForStrikeCount, type StrikeLike } from "@/lib/moderation/strike-rules";
import { OPEN_REPORT_STATUSES } from "./report-filters";
import { canRequestSpotFix, loadSpotFixTarget } from "@/lib/moderation/spot-fix";

/**
 * strike-system Task 2: 通報詳細に添える「判断の材料」
 * 出典: docs/tasks/safety/strike-system/02-strike-on-resolve.md
 *       docs/wireframes.md「SC-18 通報詳細（投稿への通報）」
 *
 * 投稿者の有効なストライクと「確定すると何が起きるか」、通報者の信頼度（直近 90 日の問題なし／全件）、
 * 同じ対象へのほかの通報（異なる通報者の数）。
 */
export interface ReportModerationContext {
  posterId: string | null;
  posterName: string | null;
  posterActiveStrikes: number;
  /** 確定したときの措置（例: 3日間 投稿・コメント禁止） */
  nextMeasure: string;
  /** 個人情報・なりすまし＝1 回で仮停止 */
  severe: boolean;
  reporter: { noIssueIn90Days: number; total: number };
  /** 同じ対象への未処理の通報（この通報を含む）の異なる通報者の数 */
  distinctReporters: number;
  autoHideReporters: number;
  /** strike-system Task 6: 「登録者に修正を依頼する」を出せるか（スポット情報の誤り × タビコエだけの場所 × 登録者あり） */
  canRequestSpotFix: boolean;
}

export async function loadReportModerationContext(admin: SupabaseClient, report: ReportDetail, now: Date = new Date()): Promise<ReportModerationContext> {
  const posterId = report.target.ownerId;
  const since = new Date(now.getTime() - 90 * 86400000).toISOString();
  const [settings, strikes, poster, reporterAll, reporterNoIssue, sameTarget, spot] = await Promise.all([
    loadModerationSettings(admin),
    posterId ? admin.from("strikes").select("created_at, expires_at, revoked_at").eq("user_id", posterId) : Promise.resolve({ data: [] as unknown[] }),
    posterId ? admin.from("users").select("display_name").eq("id", posterId).maybeSingle() : Promise.resolve({ data: null }),
    admin.from("reports").select("id", { count: "exact", head: true }).eq("reporter_id", report.reporterId).gte("created_at", since),
    admin.from("reports").select("id", { count: "exact", head: true }).eq("reporter_id", report.reporterId).eq("status", "no_issue").gte("created_at", since),
    admin.from("reports").select("reporter_id").eq("target_type", report.targetType).eq("target_id", report.targetId).in("status", [...OPEN_REPORT_STATUSES]),
    report.targetType === "spot" ? loadSpotFixTarget(admin, report.targetId).catch(() => null) : Promise.resolve(null),
  ]);
  const list: StrikeLike[] = ((strikes.data ?? []) as { created_at: string; expires_at: string; revoked_at: string | null }[]).map((r) => ({
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    revokedAt: r.revoked_at,
  }));
  const active = activeStrikeCount(list, now);
  const severe = isSevereReason(report.reason);
  return {
    posterId,
    posterName: ((poster.data as { display_name?: string | null } | null)?.display_name ?? null) || null,
    posterActiveStrikes: active,
    nextMeasure: severe ? "仮停止（重大な違反）" : describeMeasure(measureForStrikeCount(active + 1, settings)),
    severe,
    reporter: { noIssueIn90Days: reporterNoIssue.count ?? 0, total: reporterAll.count ?? 0 },
    distinctReporters: new Set(((sameTarget.data ?? []) as { reporter_id: string }[]).map((r) => r.reporter_id)).size,
    autoHideReporters: settings.autoHideReporters,
    canRequestSpotFix: canRequestSpotFix({ targetType: report.targetType, reason: report.reason }, spot),
  };
}
