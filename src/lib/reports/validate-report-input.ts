import { graphemeLength } from "@/lib/text/grapheme-length";
import {
  isReasonAllowedForTarget,
  MAX_REPORT_DETAIL_LENGTH,
  REPORT_REASONS,
  REPORT_TARGET_TYPES,
  type ReportReason,
  type ReportTargetType,
} from "./constants";

/**
 * F-SF-01 Task3: 通報入力の検証（Route Handlerとフォームで共用）
 * 出典: docs/tasks/safety/reporting/03-report-creation-handler.md
 *
 * reason × target_type の組み合わせはDB制約ではなくここで担保する（Task1の方針）。
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ReportInput {
  targetType?: unknown;
  targetId?: unknown;
  reason?: unknown;
  detail?: unknown;
}

export interface ValidatedReportFields {
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  detail: string | null;
}

/** 検証に失敗した理由。呼び出し元がそのままレスポンスのerrorに使う。 */
export type ReportValidationError =
  | "invalid_target_type"
  | "invalid_target_id"
  | "invalid_reason"
  | "reason_not_allowed_for_target"
  | "detail_too_long";

export type ReportValidationResult =
  | { ok: true; fields: ValidatedReportFields }
  | { ok: false; error: ReportValidationError };

export function isReportTargetType(value: unknown): value is ReportTargetType {
  return typeof value === "string" && REPORT_TARGET_TYPES.includes(value as ReportTargetType);
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function validateReportInput(input: ReportInput): ReportValidationResult {
  const { targetType, targetId, reason } = input;

  if (!isReportTargetType(targetType)) {
    return { ok: false, error: "invalid_target_type" };
  }
  if (!isUuid(targetId)) {
    return { ok: false, error: "invalid_target_id" };
  }
  if (typeof reason !== "string" || !REPORT_REASONS.includes(reason as ReportReason)) {
    return { ok: false, error: "invalid_reason" };
  }
  if (!isReasonAllowedForTarget(reason as ReportReason, targetType)) {
    return { ok: false, error: "reason_not_allowed_for_target" };
  }

  let detail: string | null = null;
  if (typeof input.detail === "string" && input.detail.trim() !== "") {
    detail = input.detail;
    if (graphemeLength(detail) > MAX_REPORT_DETAIL_LENGTH) {
      return { ok: false, error: "detail_too_long" };
    }
  }

  return {
    ok: true,
    fields: { targetType, targetId, reason: reason as ReportReason, detail },
  };
}
