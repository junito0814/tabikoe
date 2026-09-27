import type { SupabaseClient } from "@supabase/supabase-js";
import { REPORT_REASON_LABELS, type ReportReason } from "@/lib/reports/constants";
import { loadModerationSettings } from "./settings";
import { activeStrikeCount, describeMeasure, isPostingRestricted, measureForStrikeCount, type ModerationSettings } from "./strike-rules";

/**
 * strike-system Task 5: マイページ「アカウントの状態」（SC-28）に出すもの
 * 出典: docs/tasks/safety/strike-system/05-account-status.md
 *       要件定義書 3.10.13、docs/wireframes.md「SC-28 アカウントの状態」
 *
 * 【初心者向け】通知は流れて見逃されるので、自分の状態を**いつでも自分で確かめられる場所**を作る（Meta の Account Status と同じ考え方）。
 * 出すのは 今の制限（解除日）／有効なストライクの数としきい値／次の措置／履歴（失効分は「失効」として。取り消し分は出さない）。
 * 通報者は一切出さない。
 */
export interface AccountStatus {
  /** 投稿・コメント禁止の解除日時（制限中だけ） */
  restrictedUntil: string | null;
  activeStrikes: number;
  strikesToSuspend: number;
  expiryDays: number;
  /** 次のストライクで起きること */
  nextMeasure: string;
  history: AccountStrikeHistoryItem[];
}

export interface AccountStrikeHistoryItem {
  id: string;
  createdAt: string;
  expiresAt: string;
  /** active＝有効、expired＝失効 */
  state: "active" | "expired";
  /** 例: 感想テキストを非公開にしました */
  summary: string;
  reasonLabel: string;
}

export interface StrikeRowLike {
  id: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  reason: string;
  action: string;
  target_label: string | null;
}

/** 行 → 画面に出す形（純粋関数） */
export function buildAccountStatus(
  rows: readonly StrikeRowLike[],
  user: { postingRestrictedUntil: string | null },
  settings: ModerationSettings,
  now: Date
): AccountStatus {
  // 取り消し分は本人に見せない（無かったことにする）
  const visible = rows.filter((r) => !r.revoked_at);
  const active = activeStrikeCount(visible.map((r) => ({ createdAt: r.created_at, expiresAt: r.expires_at, revokedAt: null })), now);
  return {
    restrictedUntil: isPostingRestricted(user.postingRestrictedUntil, now) ? user.postingRestrictedUntil : null,
    activeStrikes: active,
    strikesToSuspend: settings.strikesToSuspend,
    expiryDays: settings.strikeExpiryDays,
    nextMeasure: describeMeasure(measureForStrikeCount(active + 1, settings)),
    history: [...visible]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((r) => ({
        id: r.id,
        createdAt: r.created_at,
        expiresAt: r.expires_at,
        state: new Date(r.expires_at).getTime() > now.getTime() ? "active" : "expired",
        summary: `${r.target_label ?? "投稿"}を${r.action === "delete" ? "削除" : "非公開に"}しました`,
        reasonLabel: REPORT_REASON_LABELS[r.reason as ReportReason] ?? r.reason,
      })),
  };
}

export async function getAccountStatus(admin: SupabaseClient, userId: string, now: Date = new Date()): Promise<AccountStatus> {
  const [settings, strikes, user] = await Promise.all([
    loadModerationSettings(admin),
    admin.from("strikes").select("id, created_at, expires_at, revoked_at, reason, action, target_label").eq("user_id", userId),
    admin.from("users").select("posting_restricted_until").eq("id", userId).maybeSingle(),
  ]);
  if (strikes.error) throw strikes.error;
  if (user.error) throw user.error;
  return buildAccountStatus((strikes.data ?? []) as StrikeRowLike[], { postingRestrictedUntil: (user.data?.posting_restricted_until as string | null | undefined) ?? null }, settings, now);
}
