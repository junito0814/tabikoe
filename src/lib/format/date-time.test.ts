import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { formatDate, formatDateTime, WITHIN_HOURS_MS } from "./date-time";

/**
 * 出典: Issue #771「日時の書き方を 1 か所にまとめる（秒を出さない・1 日経ったら日付だけ）」
 *
 * 【初心者向け】時刻は日本時間（Asia/Tokyo）で書く約束なので、
 * テストを動かす機械の時間帯が違っても同じ答えになる。
 */
const now = new Date("2026-10-06T12:00:00+09:00");

describe("formatDateTime（#771）", () => {
  it("24 時間以内は時刻つき（分まで）。秒は出さない", () => {
    expect(formatDateTime("2026-10-05T13:41:16+09:00", now)).toBe("10/5 13:41");
    expect(formatDateTime("2026-10-06T09:05:00+09:00", now)).toBe("10/6 09:05");
  });

  it("24 時間経ったら日付だけ", () => {
    expect(formatDateTime("2026-10-01T13:41:16+09:00", now)).toBe("2026/10/1");
  });

  it("ちょうど 24 時間は「経った」側（日付だけ）", () => {
    const exactly = new Date(now.getTime() - WITHIN_HOURS_MS).toISOString();
    expect(formatDateTime(exactly, now)).toBe("2026/10/5");
    const justInside = new Date(now.getTime() - WITHIN_HOURS_MS + 1000).toISOString();
    expect(formatDateTime(justInside, now)).toBe("10/5 12:00");
  });

  it("年をまたいでも年つきで出る", () => {
    expect(formatDateTime("2025-12-31T23:59:00+09:00", now)).toBe("2025/12/31");
  });

  it("端末の時間帯に関わらず日本時間で書く", () => {
    // 10/6 00:30 JST ＝ 10/5 15:30 UTC。UTC の機械でも「10/6」と出る
    expect(formatDateTime("2026-10-05T15:30:00Z", now)).toBe("10/6 00:30");
  });

  it("読めない値・空のときは何も出さない（画面に Invalid Date を出さない）", () => {
    expect(formatDateTime(null, now)).toBe("");
    expect(formatDateTime("", now)).toBe("");
    expect(formatDateTime("こんにちは", now)).toBe("");
  });
});

describe("formatDate（絶対日付。#771 の対象外の場所で使う）", () => {
  it("いつであっても日付だけ", () => {
    expect(formatDate("2026-10-06T09:05:00+09:00")).toBe("2026/10/6");
    expect(formatDate("2026-10-05T15:30:00Z")).toBe("2026/10/6");
  });

  it("読めない値・空のときは何も出さない", () => {
    expect(formatDate(null)).toBe("");
    expect(formatDate("x")).toBe("");
  });
});

/**
 * #771 の受入条件: `src/components` に `new Date(...).toLocaleString("ja-JP")` の
 * 直接呼び出しが残っていない。
 *
 * 【初心者向け】1 か所でも残ると、そこだけ秒まで出て書き方がバラバラになります。
 * ファイルを読んで機械的に確かめます（数の桁区切り `1,000` は日時ではないので対象外）。
 */
describe("日時の書き方が 1 か所になっている（#771）", () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) files.push(path);
    }
  };
  walk("src/components");
  walk("src/app");

  it("日時を自分で組み立てているファイルが無い", () => {
    const offenders = files.filter((path) => /new Date\([^)]*\)\.toLocale(Date|Time)?String\(/.test(readFileSync(path, "utf8")));
    expect(offenders).toEqual([]);
  });
});
