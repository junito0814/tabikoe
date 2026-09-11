import { describe, expect, it } from "vitest";
import { validateReportInput } from "./validate-report-input";
import { reasonsForTarget } from "./constants";

/**
 * 出典: docs/tasks/safety/reporting/03-report-creation-handler.md 単体テスト
 * - reason と target_type の組み合わせバリデーション（不正な組み合わせで400）
 * - 自由記述の文字数バリデーション（書記素クラスタ単位で1,000文字超で400）
 */
const TARGET_ID = "11111111-2222-4333-8444-555555555555";

function valid(overrides: Record<string, unknown> = {}) {
  return { targetType: "post", targetId: TARGET_ID, reason: "spam", detail: "", ...overrides };
}

describe("validateReportInput", () => {
  it("正しい入力を受理し、空の自由記述は null にする", () => {
    const result = validateReportInput(valid());
    expect(result).toEqual({
      ok: true,
      fields: { targetType: "post", targetId: TARGET_ID, reason: "spam", detail: null },
    });
  });

  it("未知の対象種別は invalid_target_type", () => {
    expect(validateReportInput(valid({ targetType: "album" }))).toEqual({
      ok: false,
      error: "invalid_target_type",
    });
  });

  it("UUID でない対象IDは invalid_target_id", () => {
    expect(validateReportInput(valid({ targetId: "abc" }))).toEqual({
      ok: false,
      error: "invalid_target_id",
    });
  });

  it("未知の理由は invalid_reason", () => {
    expect(validateReportInput(valid({ reason: "hate" }))).toEqual({
      ok: false,
      error: "invalid_reason",
    });
  });

  it("「なりすまし」はユーザー通報以外では reason_not_allowed_for_target", () => {
    expect(validateReportInput(valid({ targetType: "post", reason: "impersonation" }))).toEqual({
      ok: false,
      error: "reason_not_allowed_for_target",
    });
    expect(validateReportInput(valid({ targetType: "user", reason: "impersonation" })).ok).toBe(
      true
    );
  });

  it("「スポット情報の誤り」はスポット通報以外では reason_not_allowed_for_target", () => {
    expect(validateReportInput(valid({ targetType: "user", reason: "wrong_spot_info" }))).toEqual({
      ok: false,
      error: "reason_not_allowed_for_target",
    });
    expect(validateReportInput(valid({ targetType: "spot", reason: "wrong_spot_info" })).ok).toBe(
      true
    );
  });

  it("自由記述は書記素1,000文字まで受理し、1,001文字で detail_too_long", () => {
    // 絵文字（複数コードポイント）で数えても1文字扱い
    const emoji = "👨‍👩‍👧";
    expect(validateReportInput(valid({ detail: emoji.repeat(1000) })).ok).toBe(true);
    expect(validateReportInput(valid({ detail: emoji.repeat(1001) }))).toEqual({
      ok: false,
      error: "detail_too_long",
    });
  });
});

describe("reasonsForTarget", () => {
  it("共通6種に加え、user は impersonation、spot は wrong_spot_info だけを含む", () => {
    expect(reasonsForTarget("post")).toEqual([
      "inappropriate",
      "personal_info",
      "false_info",
      "copyright",
      "spam",
      "other",
    ]);
    expect(reasonsForTarget("user")).toContain("impersonation");
    expect(reasonsForTarget("user")).not.toContain("wrong_spot_info");
    expect(reasonsForTarget("spot")).toContain("wrong_spot_info");
    expect(reasonsForTarget("spot")).not.toContain("impersonation");
  });
});
