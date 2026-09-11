import { afterEach, describe, expect, it, vi } from "vitest";
import { todayInJst } from "./constants";

/**
 * 出典: docs/tasks/posts/post-creation/02-post-form-ui.md 単体テスト
 * 「未来日を選択できないこと」の基準となる「今日」が、
 * サーバーのタイムゾーンによらずJST固定であること（要件定義書3.3.1）。
 */
describe("todayInJst", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("YYYY-MM-DD形式で返す", () => {
    expect(todayInJst()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("UTCではまだ前日でも、JSTで日付が変わっていればJSTの日付を返す", () => {
    // 2026-09-10 20:00 UTC = 2026-09-11 05:00 JST
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-10T20:00:00Z"));
    expect(todayInJst()).toBe("2026-09-11");
  });

  it("UTCで日付が変わった直後でも、JSTでは同日の午前中なのでJSTの日付を返す", () => {
    // 2026-09-11 00:30 UTC = 2026-09-11 09:30 JST
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-11T00:30:00Z"));
    expect(todayInJst()).toBe("2026-09-11");
  });

  it("JSTで翌日になる直前は当日のまま", () => {
    // 2026-09-11 14:59 UTC = 2026-09-11 23:59 JST
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-11T14:59:00Z"));
    expect(todayInJst()).toBe("2026-09-11");
  });

  it("JSTで日付が変わった瞬間に翌日になる", () => {
    // 2026-09-11 15:00 UTC = 2026-09-12 00:00 JST
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-11T15:00:00Z"));
    expect(todayInJst()).toBe("2026-09-12");
  });
});
