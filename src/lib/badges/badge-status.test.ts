import { describe, expect, it } from "vitest";
import { mergeBadgeStatus } from "./badge-status";

/**
 * 出典: docs/tasks/badges/status-badges/04-badge-screen-ui.md 単体テスト
 * - 獲得済み・未獲得バッジの表示区分ロジック
 */
describe("mergeBadgeStatus", () => {
  it("獲得記録のあるバッジには acquiredAt が入り、無いものは null になる", () => {
    const statuses = mergeBadgeStatus([
      { badge_type: "post_count:1", acquired_at: "2026-09-01T00:00:00Z" },
      { badge_type: "prefecture:東京都", acquired_at: "2026-09-02T00:00:00Z" },
    ]);

    const byType = new Map(statuses.map((badge) => [badge.type, badge]));
    expect(byType.get("post_count:1")?.acquiredAt).toBe("2026-09-01T00:00:00Z");
    expect(byType.get("prefecture:東京都")?.acquiredAt).toBe("2026-09-02T00:00:00Z");
    expect(byType.get("post_count:10")?.acquiredAt).toBeNull();
    expect(byType.get("prefecture:北海道")?.acquiredAt).toBeNull();
  });

  it("未投稿の都道府県も含めてカタログ全件（63種。v3.2 でスポット登録 7 種を追加）を返す", () => {
    const statuses = mergeBadgeStatus([]);
    expect(statuses).toHaveLength(63);
    expect(statuses.every((badge) => badge.acquiredAt === null)).toBe(true);
    expect(statuses.filter((badge) => badge.category === "prefecture")).toHaveLength(47);
  });

  it("カタログに無い badge_type の記録は無視する", () => {
    const statuses = mergeBadgeStatus([{ badge_type: "legacy:1", acquired_at: "2026-01-01T00:00:00Z" }]);
    expect(statuses.find((badge) => badge.type === "legacy:1")).toBeUndefined();
  });
});
