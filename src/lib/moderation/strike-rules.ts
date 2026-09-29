import type { ReportReason } from "@/lib/reports/constants";

/**
 * strike-system Task 1: ストライクの判断のルール（純粋関数）
 * 出典: docs/tasks/safety/strike-system/01-strike-rules-and-data.md
 *       要件定義書 3.10.7「ストライク制」・3.10.8「自動で行う対応」
 *
 * 【初心者向け】「何個で何日止めるか」「誰の通報を数えるか」の判断を全部ここに閉じ込める。
 * DB や画面に触らないので、しきい値を変えたときもこのファイルのテストだけで確かめられる。
 * しきい値は moderation_settings テーブルから読む（settings.ts）。ここは値を受け取るだけ。
 */
export interface ModerationSettings {
  /** 異なる通報者が何人で自動非公開か */
  autoHideReporters: number;
  /** 直近 90 日に「問題なし」がこの件数以上の通報者は数えない */
  unreliableReporterNoIssue: number;
  /** ストライクの失効までの日数 */
  strikeExpiryDays: number;
  /** 有効なストライクが何個で仮停止か */
  strikesToSuspend: number;
  /** 有効 1・2・3・4 個のときの投稿禁止日数（0 は警告だけ） */
  restrictionDays: number[];
}

/** 要件 3.10.7・3.10.8 の既定値（moderation_settings が読めないときにも使う） */
export const DEFAULT_MODERATION_SETTINGS: ModerationSettings = {
  autoHideReporters: 3,
  unreliableReporterNoIssue: 3,
  strikeExpiryDays: 90,
  strikesToSuspend: 5,
  restrictionDays: [0, 3, 7, 30],
};

export interface StrikeLike {
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
}

/** 失効・取り消しを除いた「有効な」ストライク */
export function activeStrikes<T extends StrikeLike>(strikes: readonly T[], now: Date): T[] {
  return strikes.filter((s) => s.revokedAt === null && new Date(s.expiresAt).getTime() > now.getTime());
}

export function activeStrikeCount(strikes: readonly StrikeLike[], now: Date): number {
  return activeStrikes(strikes, now).length;
}

/** 付与日から失効日を計算する */
export function strikeExpiresAt(createdAt: Date, settings: ModerationSettings): Date {
  return new Date(createdAt.getTime() + settings.strikeExpiryDays * 24 * 60 * 60 * 1000);
}

export type Measure =
  | { kind: "none" }
  | { kind: "warn" }
  | { kind: "restrict"; days: number }
  | { kind: "suspend" };

/**
 * 有効なストライクが n 個になったときの措置（3.10.7 の段階）
 *   1 → 警告、2 → 3 日、3 → 7 日、4 → 30 日の投稿・コメント禁止、5 → 仮停止
 */
export function measureForStrikeCount(n: number, settings: ModerationSettings): Measure {
  if (n <= 0) return { kind: "none" };
  if (n >= settings.strikesToSuspend) return { kind: "suspend" };
  const days = settings.restrictionDays[n - 1] ?? settings.restrictionDays[settings.restrictionDays.length - 1] ?? 0;
  return days > 0 ? { kind: "restrict", days } : { kind: "warn" };
}

/** 措置を日本語にする（本人への通知・管理画面の予告） */
export function describeMeasure(measure: Measure): string {
  switch (measure.kind) {
    case "none":
      return "措置なし";
    case "warn":
      return "警告";
    case "restrict":
      return `${measure.days}日間 投稿・コメント禁止`;
    case "suspend":
      return "仮停止";
  }
}

/** 1 回で仮停止にする重大な違反（3.10.7）: 個人情報の掲載・なりすまし */
export function isSevereReason(reason: ReportReason): boolean {
  return reason === "personal_info" || reason === "impersonation";
}

/** 投稿・コメント禁止の解除日時。now 以降なら制限中 */
export function restrictionUntil(measure: Measure, now: Date): Date | null {
  return measure.kind === "restrict" ? new Date(now.getTime() + measure.days * 24 * 60 * 60 * 1000) : null;
}

export function isPostingRestricted(restrictedUntil: string | null | undefined, now: Date): boolean {
  return !!restrictedUntil && new Date(restrictedUntil).getTime() > now.getTime();
}

export interface PendingReportLike {
  reporterId: string;
}

/**
 * 自動非公開の判定（3.10.8）: 同じ対象への未処理の通報のうち、**異なる通報者**の数がしきい値以上か。
 * 直近 90 日に「問題なし」がしきい値以上ある通報者（信頼度が低い）は数えない。
 * @param noIssueCountByReporter 通報者 ID → 直近 90 日の「問題なし」の件数
 */
export function shouldAutoHide(
  reports: readonly PendingReportLike[],
  noIssueCountByReporter: ReadonlyMap<string, number>,
  settings: ModerationSettings
): boolean {
  return countReliableReporters(reports, noIssueCountByReporter, settings) >= settings.autoHideReporters;
}

export function countReliableReporters(
  reports: readonly PendingReportLike[],
  noIssueCountByReporter: ReadonlyMap<string, number>,
  settings: ModerationSettings
): number {
  const reporters = new Set<string>();
  for (const report of reports) {
    if ((noIssueCountByReporter.get(report.reporterId) ?? 0) >= settings.unreliableReporterNoIssue) continue;
    reporters.add(report.reporterId);
  }
  return reporters.size;
}
