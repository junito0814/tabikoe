import { describe, expect, it } from "vitest";
import { validateAnnouncementInput } from "./validate-announcement";
import {
  announcementSchema,
  ANNOUNCEMENT_ERRORS,
  firstAnnouncementError,
  MAX_ANNOUNCEMENT_BODY_LENGTH,
  MAX_ANNOUNCEMENT_TITLE_LENGTH,
} from "./announcement-schema";

/**
 * 出典: #1005「お知らせの入力を、スキーマ＋react-hook-form にする」
 * 方針: 要件定義書 7.2「入力の検証」
 *
 * 【初心者向け】いまの動きを写し取ったテストは validate-announcement.test.ts にあり、
 * そちらは**1 文字も直していません**（直さずに通ることが、動きが変わっていない証拠）。
 * こちらは**スキーマにしたから書けるようになったこと**を見ます。
 */
describe("お知らせのスキーマ（#1005）", () => {
  it("「今」を外から受け取る（スキーマの中で時計を読まない）", () => {
    // 公開日時を省略したときに入る値が、渡した「今」になる
    const fixed = "2026-03-01T09:00:00.000Z";
    const result = validateAnnouncementInput({ title: "お知らせ", body: "本文" }, fixed);
    expect(result.ok && result.fields.publishedAt).toBe(fixed);
  });

  it("画面に出す文とサーバーが返す合言葉が、1 つの表で対応している", () => {
    // 画面はこの文をそのまま出し、サーバーは左の合言葉を返す
    expect(ANNOUNCEMENT_ERRORS.title_too_long).toBe(`タイトルは${MAX_ANNOUNCEMENT_TITLE_LENGTH}文字までです`);
    expect(ANNOUNCEMENT_ERRORS.body_too_long).toBe(
      `本文は${MAX_ANNOUNCEMENT_BODY_LENGTH.toLocaleString("ja-JP")}文字までです`,
    );
  });

  it("画面と同じ値の形（すべて文字列）をそのまま確かめられる", () => {
    const parsed = announcementSchema("2026-03-01T09:00:00.000Z").safeParse({
      title: "  メンテナンス  ",
      body: "  2:00〜4:00  ",
      // <input type="datetime-local"> が返す形
      publishedAt: "2026-03-05T18:30",
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.title).toBe("メンテナンス");
    expect(parsed.data.body).toBe("2:00〜4:00");
    // ローカル時刻として読んで、保存用の形（ISO）にそろえる
    expect(parsed.data.publishedAt).toBe(new Date("2026-03-05T18:30").toISOString());
  });

  it("空の入力では、欄ごとに理由が付く（画面が欄の下に出せる）", () => {
    const parsed = announcementSchema("2026-03-01T09:00:00.000Z").safeParse({ title: "", body: "", publishedAt: "" });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    const byField = Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message]));
    expect(byField.title).toBe(ANNOUNCEMENT_ERRORS.title_required);
    expect(byField.body).toBe(ANNOUNCEMENT_ERRORS.body_required);
    // 公開日時は空なら「今」が入るので、理由は付かない
    expect(byField.publishedAt).toBeUndefined();
  });

  it("複数おかしいときに返す合言葉は 1 つ（タイトル → 本文 → 公開日時の順）", () => {
    expect(
      firstAnnouncementError([
        { code: "custom", path: ["body"], message: ANNOUNCEMENT_ERRORS.body_required },
        { code: "custom", path: ["title"], message: ANNOUNCEMENT_ERRORS.title_required },
      ] as never[]),
    ).toBe("title_required");
    expect(
      firstAnnouncementError([
        { code: "custom", path: ["title"], message: ANNOUNCEMENT_ERRORS.title_too_long } as never,
      ]),
    ).toBe("title_too_long");
  });
});
