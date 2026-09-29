import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_MODERATION_SETTINGS, type ModerationSettings } from "./strike-rules";

/**
 * strike-system Task 1: しきい値（moderation_settings）の読み出し
 * 出典: docs/tasks/safety/strike-system/01-strike-rules-and-data.md
 *
 * 【初心者向け】値はテーブルに置き、読めない・欠けているキーは既定値で埋める。
 * こうしておくと、しきい値を変えるのは SQL 1 行で済み、判断のコード（strike-rules.ts）は触らない。
 */
const KEYS: Record<keyof ModerationSettings, string> = {
  autoHideReporters: "auto_hide_reporters",
  unreliableReporterNoIssue: "unreliable_reporter_no_issue",
  strikeExpiryDays: "strike_expiry_days",
  strikesToSuspend: "strikes_to_suspend",
  restrictionDays: "restriction_days",
};

/** 行の配列 → 設定（不正な値は既定値。純粋関数） */
export function settingsFromRows(rows: readonly { key: string; value: unknown }[]): ModerationSettings {
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const num = (name: keyof ModerationSettings) => {
    const v = byKey.get(KEYS[name]);
    return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : (DEFAULT_MODERATION_SETTINGS[name] as number);
  };
  const days = byKey.get(KEYS.restrictionDays);
  const restrictionDays =
    Array.isArray(days) && days.length > 0 && days.every((d) => typeof d === "number" && d >= 0)
      ? (days as number[])
      : DEFAULT_MODERATION_SETTINGS.restrictionDays;
  return {
    autoHideReporters: num("autoHideReporters"),
    unreliableReporterNoIssue: num("unreliableReporterNoIssue"),
    strikeExpiryDays: num("strikeExpiryDays"),
    strikesToSuspend: num("strikesToSuspend"),
    restrictionDays,
  };
}

export async function loadModerationSettings(admin: SupabaseClient): Promise<ModerationSettings> {
  try {
    const { data, error } = await admin.from("moderation_settings").select("key, value");
    if (error) throw error;
    return settingsFromRows((data ?? []) as { key: string; value: unknown }[]);
  } catch (error) {
    console.error("[moderation] しきい値を読めなかったので既定値を使います:", error instanceof Error ? error.message : error);
    return DEFAULT_MODERATION_SETTINGS;
  }
}
