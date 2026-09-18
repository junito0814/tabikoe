/**
 * 出典: docs/tasks/data-model/table-catalog-v3/05-rate-limit-actions-and-verification.md（単体テスト）
 * 「各 action の上限値と時間枠が定義どおりであること」
 */
import { describe, expect, it } from "vitest";
import { RATE_LIMIT_ACTIONS } from "./actions";

describe("RATE_LIMIT_ACTIONS", () => {
  it("しおり招待は 1 時間 10 件", () => {
    expect(RATE_LIMIT_ACTIONS.itineraryInvite).toEqual({ actionType: "itinerary_invite", windowSeconds: 3600, limit: 10 });
  });
  it("下書き保存は 1 時間 60 件", () => {
    expect(RATE_LIMIT_ACTIONS.draftSave).toEqual({ actionType: "draft_save", windowSeconds: 3600, limit: 60 });
  });
  it("まだあった報告は 1 日 50 件", () => {
    expect(RATE_LIMIT_ACTIONS.spotStatusReport).toEqual({ actionType: "spot_status_report", windowSeconds: 86400, limit: 50 });
  });
  it("actionType が重複しない", () => {
    const types = Object.values(RATE_LIMIT_ACTIONS).map((a) => a.actionType);
    expect(new Set(types).size).toBe(types.length);
  });
});
