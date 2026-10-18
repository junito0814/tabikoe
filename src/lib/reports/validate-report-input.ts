import { REPORT_TARGET_TYPES, type ReportTargetType } from "./constants";
import {
  firstReportError,
  reportSchema,
  uuidSchema,
  type ReportValidationError,
  type ValidatedReportFields,
} from "./report-schema";

/**
 * F-SF-01 Task3: 通報入力の検証（サーバー側の入口）
 * 出典: docs/tasks/safety/reporting/03-report-creation-handler.md
 *       要件定義書 7.2「入力の検証」
 *
 * 【初心者向け】2026-10-18（#1007）に、**規則そのものを report-schema.ts へ移しました**。
 * ここに残っているのは「**ブラウザから来た値を文字列に直して、スキーマに渡す**」だけです。
 * reason × target_type の組み合わせもスキーマ側で見ています（Task1 の方針どおり、DB 制約ではない）。
 */
export type { ReportValidationError, ValidatedReportFields };

export interface ReportInput {
  targetType?: unknown;
  targetId?: unknown;
  reason?: unknown;
  detail?: unknown;
}

export type ReportValidationResult =
  | { ok: true; fields: ValidatedReportFields }
  | { ok: false; error: ReportValidationError };

/** 通報の対象の種別か（画面を開く前の確認にも使う。src/app/report/page.tsx） */
export function isReportTargetType(value: unknown): value is ReportTargetType {
  return typeof value === "string" && REPORT_TARGET_TYPES.includes(value as ReportTargetType);
}

/** UUID の形か（同上）。形の定義はスキーマ側に 1 つだけ置く */
export function isUuid(value: unknown): value is string {
  return uuidSchema.safeParse(value).success;
}

export function validateReportInput(input: ReportInput): ReportValidationResult {
  const result = reportSchema.safeParse({
    // 文字列以外は「選ばれていない」として扱う（スキーマが選択肢から外れていると判断する）
    targetType: typeof input.targetType === "string" ? input.targetType : "",
    targetId: typeof input.targetId === "string" ? input.targetId : "",
    reason: typeof input.reason === "string" ? input.reason : "",
    // 詳細は任意。文字列以外は「書かれていない」として扱う
    detail: typeof input.detail === "string" ? input.detail : "",
  });

  if (!result.success) {
    return { ok: false, error: firstReportError(result.error.issues) };
  }
  return { ok: true, fields: result.data };
}
