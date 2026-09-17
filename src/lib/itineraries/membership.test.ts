import { describe, expect, it } from "vitest";
import { can, ITINERARY_PERMISSIONS, resolveItineraryRole } from "./membership";

/**
 * 出典: docs/tasks/itinerary/itinerary-basics/01-itinerary-crud-api.md 単体テスト
 * - 権限判定関数（owner／member／none）
 * 出典: docs/tasks/itinerary/itinerary-sharing/03-permissions-and-ownership.md 単体テスト
 * - 権限表（操作 × 役割）の判定
 */
describe("resolveItineraryRole", () => {
  it("行の role をそのまま、無ければ null", () => {
    expect(resolveItineraryRole({ role: "owner" })).toBe("owner");
    expect(resolveItineraryRole({ role: "member" })).toBe("member");
    expect(resolveItineraryRole({ role: "editor" })).toBeNull();
    expect(resolveItineraryRole(null)).toBeNull();
  });
});

describe("can（権限表）", () => {
  it("メンバーはスポット・Day・時刻・メモ・チェックを操作できる", () => {
    for (const action of ["view", "add_spot", "remove_spot", "move_day", "set_time", "edit_memo", "reorder", "check"] as const) {
      expect(can("member", action)).toBe(true);
      expect(can("owner", action)).toBe(true);
    }
  });

  it("招待・メンバー削除・期間・タイトル・削除はオーナーだけ", () => {
    for (const action of ["invite", "manage_members", "change_period", "rename", "delete"] as const) {
      expect(can("owner", action)).toBe(true);
      expect(can("member", action)).toBe(false);
    }
  });

  it("非メンバーは何もできない", () => {
    for (const action of Object.keys(ITINERARY_PERMISSIONS) as (keyof typeof ITINERARY_PERMISSIONS)[]) {
      expect(can(null, action)).toBe(false);
    }
  });
});
