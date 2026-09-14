import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { REPORT_TARGET_TYPES } from "@/lib/reports/constants";
import {
  applyModerationEffect,
  planModerationEffect,
  resolveReportStatus,
  shouldNotifyReporter,
} from "./moderation";

/**
 * 出典: docs/tasks/admin/report-handling/01-report-action-handler.md 単体テスト
 * - 「非公開化」「削除」「問題なし」の各操作で、対象種別（投稿／コメント／写真・動画／感想／ユーザー／スポット／アルバム）
 *   ごとに正しい読み替え処理が呼ばれることを検証する
 * 出典: docs/tasks/admin/report-handling/02-notification-on-delete.md 単体テスト
 * - 対応操作が「削除」の場合のみ通知作成処理が呼び出されることを検証する
 */
vi.mock("@/lib/posts/photos", () => ({ removeStorageObjects: vi.fn(async () => {}) }));

describe("planModerationEffect", () => {
  it("問題なしは対象を変更しない（全種別）", () => {
    for (const targetType of REPORT_TARGET_TYPES) {
      expect(planModerationEffect(targetType, "no_issue")).toEqual({ kind: "none" });
    }
  });

  it("投稿・コメント・写真は非公開化＝hidden_at、削除＝物理削除", () => {
    expect(planModerationEffect("post", "hide")).toEqual({ kind: "hide", table: "posts", column: "hidden_at" });
    expect(planModerationEffect("post", "delete")).toEqual({ kind: "delete", table: "posts" });
    expect(planModerationEffect("comment", "hide")).toEqual({ kind: "hide", table: "comments", column: "hidden_at" });
    expect(planModerationEffect("comment", "delete")).toEqual({ kind: "delete", table: "comments" });
    expect(planModerationEffect("post_photo", "hide")).toEqual({ kind: "hide", table: "post_photos", column: "hidden_at" });
    expect(planModerationEffect("post_photo", "delete")).toEqual({ kind: "delete", table: "post_photos" });
  });

  it("感想テキストは非公開化＝review_hidden_at、削除＝本文を消す", () => {
    expect(planModerationEffect("post_review", "hide")).toEqual({ kind: "hide", table: "posts", column: "review_hidden_at" });
    expect(planModerationEffect("post_review", "delete")).toEqual({ kind: "clear_review", table: "posts" });
  });

  it("ユーザーはアカウントの一時停止、スポット・アルバムは非公開化に読み替える", () => {
    expect(planModerationEffect("user", "hide")).toEqual({ kind: "suspend_user" });
    expect(planModerationEffect("user", "delete")).toEqual({ kind: "suspend_user" });
    expect(planModerationEffect("spot", "hide")).toEqual({ kind: "hide", table: "spots", column: "hidden_at" });
    expect(planModerationEffect("spot", "delete")).toEqual({ kind: "hide", table: "spots", column: "hidden_at" });
    expect(planModerationEffect("trip", "hide")).toEqual({ kind: "hide", table: "trips", column: "hidden_at" });
    expect(planModerationEffect("trip", "delete")).toEqual({ kind: "hide", table: "trips", column: "hidden_at" });
  });
});

describe("resolveReportStatus / shouldNotifyReporter", () => {
  it("対応状態への対応", () => {
    expect(resolveReportStatus("hide")).toBe("resolved_hidden");
    expect(resolveReportStatus("delete")).toBe("resolved_deleted");
    expect(resolveReportStatus("no_issue")).toBe("no_issue");
  });

  it("通報者への通知は削除の場合のみ", () => {
    expect(shouldNotifyReporter("delete")).toBe(true);
    expect(shouldNotifyReporter("hide")).toBe(false);
    expect(shouldNotifyReporter("no_issue")).toBe(false);
  });
});

describe("applyModerationEffect", () => {
  function fakeAdmin() {
    const calls: { table: string; op: string; payload?: unknown; id?: string }[] = [];
    const admin = {
      from: (table: string) => ({
        update: (payload: unknown) => ({
          eq: async (_col: string, id: string) => {
            calls.push({ table, op: "update", payload, id });
            return { error: null };
          },
        }),
        delete: () => ({
          eq: async (_col: string, id: string) => {
            calls.push({ table, op: "delete", id });
            return { error: null };
          },
        }),
        select: () => ({
          eq: () => {
            const result = { data: [] as unknown[], error: null };
            return Object.assign(Promise.resolve(result), { maybeSingle: async () => ({ data: null, error: null }) });
          },
        }),
      }),
    } as unknown as SupabaseClient;
    return { admin, calls };
  }

  it("非公開化は hidden_at を現在時刻で更新する", async () => {
    const { admin, calls } = fakeAdmin();
    const now = new Date("2026-09-14T00:00:00Z");
    await applyModerationEffect(admin, { kind: "hide", table: "comments", column: "hidden_at" }, "c1", now);
    expect(calls).toEqual([{ table: "comments", op: "update", payload: { hidden_at: now.toISOString() }, id: "c1" }]);
  });

  it("ユーザーの一時停止は users.suspended_at を更新する", async () => {
    const { admin, calls } = fakeAdmin();
    await applyModerationEffect(admin, { kind: "suspend_user" }, "u1", new Date("2026-09-14T00:00:00Z"));
    expect(calls[0]).toMatchObject({ table: "users", op: "update", id: "u1" });
  });

  it("削除は対象行を消す", async () => {
    const { admin, calls } = fakeAdmin();
    await applyModerationEffect(admin, { kind: "delete", table: "comments" }, "c1");
    expect(calls).toEqual([{ table: "comments", op: "delete", id: "c1" }]);
  });
});
