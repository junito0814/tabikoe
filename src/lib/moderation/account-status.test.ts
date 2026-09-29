import { describe, expect, it } from "vitest";
import { DEFAULT_MODERATION_SETTINGS as S } from "./strike-rules";
import { buildAccountStatus } from "./account-status";

/** 出典: docs/tasks/safety/strike-system/05-account-status.md 単体テスト */
const now = new Date("2026-09-27T00:00:00Z");
const row = (id: string, createdDaysAgo: number, revoked = false, action = "hide") => ({
  id,
  created_at: new Date(now.getTime() - createdDaysAgo * 86400000).toISOString(),
  expires_at: new Date(now.getTime() + (90 - createdDaysAgo) * 86400000).toISOString(),
  revoked_at: revoked ? now.toISOString() : null,
  reason: "inappropriate",
  action,
  target_label: "感想テキスト",
});

describe("buildAccountStatus", () => {
  it("有効と失効を区別し、取り消し分は出さない。次の措置と制限中の解除日", () => {
    const status = buildAccountStatus(
      [row("a", 2), row("b", 17), row("c", 100), row("d", 5, true)],
      { postingRestrictedUntil: "2026-09-28T09:10:00Z" },
      S,
      now
    );
    expect(status.activeStrikes).toBe(2);
    expect(status.strikesToSuspend).toBe(5);
    expect(status.nextMeasure).toBe("7日間 投稿・コメント禁止");
    expect(status.restrictedUntil).toBe("2026-09-28T09:10:00Z");
    expect(status.history.map((h) => [h.id, h.state])).toEqual([
      ["a", "active"],
      ["b", "active"],
      ["c", "expired"],
    ]);
    expect(status.history[0].summary).toBe("感想テキストを非公開にしました");
    expect(status.history[0].reasonLabel).toBe("不適切な表現");
  });

  it("制限が過ぎていれば null、削除は「削除しました」", () => {
    const status = buildAccountStatus([row("a", 1, false, "delete")], { postingRestrictedUntil: "2026-09-26T00:00:00Z" }, S, now);
    expect(status.restrictedUntil).toBeNull();
    expect(status.history[0].summary).toBe("感想テキストを削除しました");
  });
});
