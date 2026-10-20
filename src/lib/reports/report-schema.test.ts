import { describe, expect, it } from "vitest";
import { firstReportError, reportSchema, uuidSchema } from "./report-schema";
import { MAX_REPORT_DETAIL_LENGTH } from "./constants";

/**
 * 出典: #1007「通報の入力を、スキーマ＋react-hook-form にする」
 * 方針: 要件定義書 7.2「入力の検証」
 *
 * 【初心者向け】いまの動きを写し取ったテストは validate-report-input.test.ts にあり、
 * そちらは **1 文字も直していません**。こちらは**スキーマにしたから書けること**を見ます。
 * いちばん大きいのは「**画面がそのままの値で通るかを聞ける**」ことです
 * （送信ボタンを押せるかの判定に使っています）。
 */
const VALID = {
  targetType: "post",
  targetId: "11111111-2222-4333-8444-555555555555",
  reason: "spam",
  detail: "",
} as const;

describe("通報のスキーマ（#1007）", () => {
  it("画面の値（入力中の形）をそのまま確かめられる", () => {
    expect(reportSchema.safeParse(VALID).success).toBe(true);
    // 理由を選んでいない＝通らない（画面はこれで送信ボタンを押せなくする）
    expect(reportSchema.safeParse({ ...VALID, reason: undefined }).success).toBe(false);
    // 詳細が長すぎる＝通らない
    expect(reportSchema.safeParse({ ...VALID, detail: "あ".repeat(MAX_REPORT_DETAIL_LENGTH + 1) }).success).toBe(false);
  });

  it("理由と対象の組み合わせも、送られてきた値だけで判断する", () => {
    // 「なりすまし」は利用者の通報だけ
    expect(reportSchema.safeParse({ ...VALID, targetType: "user", reason: "impersonation" }).success).toBe(true);
    const wrong = reportSchema.safeParse({ ...VALID, targetType: "post", reason: "impersonation" });
    expect(wrong.success).toBe(false);
    if (wrong.success) return;
    // どの欄の問題かが分かる（画面は「理由」の欄に出せる）
    expect(wrong.error.issues[0]?.path).toEqual(["reason"]);
    expect(firstReportError(wrong.error.issues)).toBe("reason_not_allowed_for_target");
  });

  it("空欄の詳細は「無し」になる（空の文字列では保存しない）", () => {
    const parsed = reportSchema.safeParse({ ...VALID, detail: "   " });
    expect(parsed.success && parsed.data.detail).toBeNull();
    const written = reportSchema.safeParse({ ...VALID, detail: " 気になりました " });
    // 書かれているときは、前後の空白も含めてそのまま残す（作り替える前と同じ）
    expect(written.success && written.data.detail).toBe(" 気になりました ");
  });

  it("対象 id の形だけを単体で確かめられる（画面を開く前の確認に使う）", () => {
    expect(uuidSchema.safeParse("11111111-2222-4333-8444-555555555555").success).toBe(true);
    expect(uuidSchema.safeParse("1111").success).toBe(false);
    expect(uuidSchema.safeParse(123).success).toBe(false);
  });

  it("絵文字は見た目どおり 1 文字として数える", () => {
    const family = "👨‍👩‍👧";
    expect(reportSchema.safeParse({ ...VALID, detail: family.repeat(MAX_REPORT_DETAIL_LENGTH) }).success).toBe(true);
    expect(reportSchema.safeParse({ ...VALID, detail: family.repeat(MAX_REPORT_DETAIL_LENGTH + 1) }).success).toBe(
      false,
    );
  });
});
