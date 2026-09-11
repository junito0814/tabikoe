/**
 * 通報の入力規則（要件定義書3.8.1、7.3）
 * DB側の制約は 20260912000002_create_reports_table.sql に対応する定義がある。
 */
export const REPORT_TARGET_TYPES = [
  "post",
  "post_photo",
  "post_review",
  "comment",
  "user",
  "spot",
  "trip",
] as const;

export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

export const REPORT_TARGET_LABELS: Record<ReportTargetType, string> = {
  post: "投稿",
  post_photo: "写真・動画",
  post_review: "感想テキスト",
  comment: "コメント",
  user: "ユーザー",
  spot: "スポット",
  trip: "アルバム",
};

export const REPORT_REASONS = [
  "inappropriate",
  "personal_info",
  "false_info",
  "copyright",
  "spam",
  "impersonation",
  "wrong_spot_info",
  "other",
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  inappropriate: "不適切な表現",
  personal_info: "個人情報の掲載",
  false_info: "虚偽の情報",
  copyright: "著作権・肖像権の侵害",
  spam: "スパム・宣伝目的",
  impersonation: "なりすまし",
  wrong_spot_info: "スポット情報の誤り",
  other: "その他",
};

/**
 * 対象種別ごとに選べる理由。「なりすまし」はユーザー、「スポット情報の誤り」はスポットのみ。
 * 「その他」は常に末尾に置く。
 */
export function reasonsForTarget(targetType: ReportTargetType): ReportReason[] {
  const common: ReportReason[] = ["inappropriate", "personal_info", "false_info", "copyright", "spam"];
  if (targetType === "user") common.push("impersonation");
  if (targetType === "spot") common.push("wrong_spot_info");
  common.push("other");
  return common;
}

export function isReasonAllowedForTarget(reason: ReportReason, targetType: ReportTargetType): boolean {
  return reasonsForTarget(targetType).includes(reason);
}

/** 自由記述の最大文字数（書記素クラスタ単位） */
export const MAX_REPORT_DETAIL_LENGTH = 1000;

/** 通報のレート制限（1ユーザーにつき1日20件まで、7.3） */
export const REPORT_RATE_LIMIT_WINDOW_SECONDS = 24 * 60 * 60;
export const REPORT_RATE_LIMIT_MAX_ATTEMPTS = 20;
