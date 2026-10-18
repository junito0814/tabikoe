import { z } from "zod";
import { graphemeLength } from "@/lib/text/grapheme-length";
import { isReasonAllowedForTarget, MAX_REPORT_DETAIL_LENGTH, REPORT_REASONS, REPORT_TARGET_TYPES } from "./constants";

/**
 * 通報の入力規則（スキーマ）
 * 出典: #1007「通報の入力を、スキーマ＋react-hook-form にする」
 *       要件定義書 3.8（通報）／7.2「入力の検証」
 *
 * 【初心者向け】**規則が書いてあるのはこのファイルだけ**です。
 * サーバー（Route Handlers）と画面（ReportForm）の両方がこれを読みます。
 *
 * 通報には「理由と対象の組み合わせ」という規則もあります
 * （「なりすまし」は利用者の通報だけ、「スポット情報の誤り」はスポットの通報だけ）。
 * これは**送られてきた値だけで判断できる**ので、スキーマに書けます。
 * 逆に「その対象が実際にあるか」「同じ対象をもう通報していないか」は DB を見るので、
 * Route Handlers に残します（要件定義書 7.2）。
 */

/** 対象 id の形（UUID）。画面を開く前の確認にも使うので、単体で取り出せるようにしておく */
export const uuidSchema = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

/** 断る理由。サーバーはこの合言葉を応答に入れる */
export type ReportValidationError =
  "invalid_target_type" | "invalid_target_id" | "invalid_reason" | "reason_not_allowed_for_target" | "detail_too_long";

/** 複数おかしいときに、どれを先に返すか（作り替える前の検証と同じ順番） */
const ERROR_PRIORITY: readonly ReportValidationError[] = [
  "invalid_target_type",
  "invalid_target_id",
  "invalid_reason",
  "reason_not_allowed_for_target",
  "detail_too_long",
];

/**
 * 通報のスキーマ。
 *
 * 画面のフォームが持つ値の形がそのまま入力の形になっている
 * （対象の種別と id は画面の props から入り、理由はラジオ、詳細は文字入力）。
 */
export const reportSchema = z
  .object({
    targetType: z.enum(REPORT_TARGET_TYPES),
    targetId: uuidSchema,
    reason: z.enum(REPORT_REASONS),
    // 詳細は任意。空欄でも通る（文字数だけ見る）
    detail: z
      .string()
      // 【初心者向け】`graphemeLength` は「人が 1 文字と数える単位」で数えます（要件定義書 7.2）
      .refine((value) => graphemeLength(value) <= MAX_REPORT_DETAIL_LENGTH, { error: "detail_too_long" }),
  })
  /*
   * 項目をまたぐ規則は `superRefine` に書き、**どの欄の問題か**も指定する。
   * こうすると画面側で「理由」の欄にエラーを出せる。
   */
  .superRefine((fields, ctx) => {
    if (!isReasonAllowedForTarget(fields.reason, fields.targetType)) {
      ctx.addIssue({ code: "custom", path: ["reason"], message: "reason_not_allowed_for_target" });
    }
  })
  // 空欄（空白だけも含む）は「無し」として保存する
  .transform((fields) => ({ ...fields, detail: fields.detail.trim() === "" ? null : fields.detail }));

/** 画面のフォームが持つ値の形 */
export type ReportFormValues = z.input<typeof reportSchema>;

/** 通ったあとの形（保存する値） */
export type ValidatedReportFields = z.output<typeof reportSchema>;

/** 集まったエラーから、先に返すべき 1 つの合言葉を選ぶ */
export function firstReportError(issues: readonly z.core.$ZodIssue[]): ReportValidationError {
  const codes = issues.map((issue) => codeOfIssue(issue));
  for (const candidate of ERROR_PRIORITY) {
    if (codes.includes(candidate)) return candidate;
  }
  return "invalid_reason";
}

function codeOfIssue(issue: z.core.$ZodIssue): ReportValidationError | undefined {
  // 項目をまたぐ規則と文字数は、合言葉そのものを message に入れている
  if (issue.message === "reason_not_allowed_for_target" || issue.message === "detail_too_long") {
    return issue.message;
  }
  const field = String(issue.path[0] ?? "");
  if (field === "targetType") return "invalid_target_type";
  if (field === "targetId") return "invalid_target_id";
  if (field === "reason") return "invalid_reason";
  if (field === "detail") return "detail_too_long";
  return undefined;
}
