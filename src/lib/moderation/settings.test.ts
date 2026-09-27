import { describe, expect, it } from "vitest";
import { settingsFromRows } from "./settings";
import { DEFAULT_MODERATION_SETTINGS } from "./strike-rules";

/** 出典: docs/tasks/safety/strike-system/01-strike-rules-and-data.md 単体テスト */
describe("settingsFromRows", () => {
  it("テーブルの値を読み、欠けているキーは既定値", () => {
    const s = settingsFromRows([
      { key: "auto_hide_reporters", value: 4 },
      { key: "restriction_days", value: [0, 1, 2, 3] },
    ]);
    expect(s.autoHideReporters).toBe(4);
    expect(s.restrictionDays).toEqual([0, 1, 2, 3]);
    expect(s.strikesToSuspend).toBe(DEFAULT_MODERATION_SETTINGS.strikesToSuspend);
  });

  it("不正な値（0・文字列・空配列）は既定値に戻す", () => {
    const s = settingsFromRows([
      { key: "strikes_to_suspend", value: 0 },
      { key: "strike_expiry_days", value: "90" },
      { key: "restriction_days", value: [] },
    ]);
    expect(s).toEqual(DEFAULT_MODERATION_SETTINGS);
  });
});
