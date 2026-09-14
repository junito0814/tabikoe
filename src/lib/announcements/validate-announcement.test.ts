import { describe, expect, it } from "vitest";
import { validateAnnouncementInput } from "./validate-announcement";

/**
 * 出典: docs/tasks/admin/announcement-management/02-announcement-crud-handler.md 単体テスト
 * - 正常系：タイトル・本文・公開日時を指定した作成リクエストで、レコードが正しく保存される（入力が通る）
 * - 異常系：タイトルが101文字、本文が2,001文字（書記素クラスタ単位）の場合に保存が拒否される
 */
describe("validateAnnouncementInput", () => {
  it("タイトル・本文・公開日時が揃っていれば通る", () => {
    const result = validateAnnouncementInput({
      title: " メンテナンスのお知らせ ",
      body: "9/20 2:00〜4:00 に停止します",
      publishedAt: "2026-09-15T00:00:00+09:00",
    });
    expect(result).toEqual({
      ok: true,
      fields: {
        title: "メンテナンスのお知らせ",
        body: "9/20 2:00〜4:00 に停止します",
        publishedAt: "2026-09-14T15:00:00.000Z",
      },
    });
  });

  it("タイトル100文字は通り、101文字は拒否", () => {
    expect(validateAnnouncementInput({ title: "あ".repeat(100), body: "b" }).ok).toBe(true);
    expect(validateAnnouncementInput({ title: "あ".repeat(101), body: "b" })).toEqual({ ok: false, error: "title_too_long" });
  });

  it("本文2,000文字は通り、2,001文字（絵文字含む書記素単位）は拒否", () => {
    expect(validateAnnouncementInput({ title: "t", body: "あ".repeat(2000) }).ok).toBe(true);
    expect(validateAnnouncementInput({ title: "t", body: "👨‍👩‍👧".repeat(2001) })).toEqual({ ok: false, error: "body_too_long" });
    expect(validateAnnouncementInput({ title: "t", body: "👨‍👩‍👧".repeat(2000) }).ok).toBe(true);
  });

  it("空のタイトル・本文、不正な公開日時は拒否", () => {
    expect(validateAnnouncementInput({ title: "", body: "b" })).toEqual({ ok: false, error: "title_required" });
    expect(validateAnnouncementInput({ title: "t", body: "  " })).toEqual({ ok: false, error: "body_required" });
    expect(validateAnnouncementInput({ title: "t", body: "b", publishedAt: "not a date" })).toEqual({ ok: false, error: "invalid_published_at" });
  });

  it("公開日時を省略すると現在時刻", () => {
    const result = validateAnnouncementInput({ title: "t", body: "b" });
    expect(result.ok && Math.abs(Date.parse(result.fields.publishedAt) - Date.now()) < 5000).toBe(true);
  });
});
