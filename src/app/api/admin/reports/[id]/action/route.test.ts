import { beforeEach, describe, expect, it, vi } from "vitest";
import { claimsResultOf } from "@/lib/auth/claims-result";

/**
 * 出典: docs/tasks/admin/report-handling/01-report-action-handler.md 単体テスト
 * - 対応した管理者・対応日時・対応理由が reports に正しく記録されることを検証する
 * 出典: docs/tasks/admin/report-handling/02-notification-on-delete.md 単体テスト
 * - 対応操作が「削除」の場合のみ通知作成処理が呼び出されることを検証する
 * - 「非公開化」「問題なし」の場合は通知作成処理が呼び出されないことを検証する
 * - 被通報者宛の通知が生成されないことを検証する
 */
const state = {
  user: { id: "admin-1" } as { id: string } | null,
  isAdmin: true,
  report: { id: "r1", reporter_id: "reporter", target_type: "comment", target_id: "c1", status: "unconfirmed" } as Record<string, unknown> | null,
};

const reportUpdate = vi.fn(() => ({ eq: async () => ({ error: null }) }));
// strike-system Task 2: ストライクの付与は apply-strike.test.ts で確かめるので、ここでは呼ばれ方だけ見る
const { applyStrikeForReport } = vi.hoisted(() => ({
  applyStrikeForReport: vi.fn(async () => ({ strikeId: "s1", activeCount: 1, measure: { kind: "warn" }, severe: false, postingRestrictedUntil: null })),
}));
vi.mock("@/lib/moderation/apply-strike", () => ({ applyStrikeForReport }));
vi.mock("@/lib/reports/find-report-target", () => ({ findReportTarget: async () => ({ ownerId: "bad" }) }));
const notificationInsert = vi.fn(async () => ({ error: null }));
const effects: string[] = [];

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getClaims: async () => claimsResultOf(state.user) } }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "users") {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { is_admin: state.isAdmin } }) }) }),
          update: (payload: Record<string, unknown>) => ({
            eq: async () => {
              effects.push(`users.update:${Object.keys(payload).join(",")}`);
              return { error: null };
            },
          }),
        };
      }
      if (table === "notifications") return { insert: notificationInsert };
      if (table === "operation_logs" || table === "admin_actions") return { insert: async () => ({ error: null }) };
      if (table === "reports") {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.report, error: null }) }) }),
          update: reportUpdate,
        };
      }
      // 対象テーブル（comments 等）。strike-system Task 3 の restoreAutoHidden は update().eq().eq().select() の形で呼ぶ
      return {
        update: (payload: Record<string, unknown>) => {
          const chain = {
            eq: () => chain,
            select: async () => ({ data: [], error: null }),
            then: (resolve: (v: unknown) => void) => {
              effects.push(`${table}.update:${Object.keys(payload).join(",")}`);
              resolve({ error: null });
            },
          };
          return chain;
        },
        delete: () => ({
          eq: async () => {
            effects.push(`${table}.delete`);
            return { error: null };
          },
        }),
        select: () => ({ eq: () => Object.assign(Promise.resolve({ data: [], error: null }), { maybeSingle: async () => ({ data: null }) }) }),
      };
    },
  }),
}));
vi.mock("@/lib/posts/photos", () => ({ removeStorageObjects: vi.fn(async () => {}) }));

import { POST } from "./route";

const act = (action: string, note?: string) =>
  POST(
    new Request("http://localhost", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, note }) }),
    { params: Promise.resolve({ id: "r1" }) }
  );

beforeEach(() => {
  state.user = { id: "admin-1" };
  state.isAdmin = true;
  state.report = { id: "r1", reporter_id: "reporter", target_type: "comment", target_id: "c1", status: "unconfirmed" };
  reportUpdate.mockClear();
  notificationInsert.mockClear();
  applyStrikeForReport.mockClear();
  effects.length = 0;
  vi.useRealTimers();
});

describe("POST /api/admin/reports/[id]/action", () => {
  it("非公開化: 対象を hidden_at で伏せ、管理者・日時・理由を reports に記録し、通知は送らない", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-14T12:00:00Z"));
    const response = await act("hide", "不適切な表現のため");
    expect(response.status).toBe(200);
    expect(effects).toEqual(["comments.update:hidden_at,hidden_reason"]);
    expect(reportUpdate).toHaveBeenCalledWith({
      status: "resolved_hidden",
      resolved_by: "admin-1",
      resolved_at: "2026-09-14T12:00:00.000Z",
      resolution_note: "不適切な表現のため",
    });
    expect(notificationInsert).not.toHaveBeenCalled();
  });

  it("削除: 対象を消し、通報者にのみ report_resolved 通知を送る", async () => {
    await act("delete", "スパム");
    expect(effects).toEqual(["comments.delete"]);
    expect(reportUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: "resolved_deleted", resolution_note: "スパム" }));
    expect(notificationInsert).toHaveBeenCalledTimes(1);
    expect(notificationInsert).toHaveBeenCalledWith({ user_id: "reporter", type: "report_resolved", related_id: "r1", is_read: false });
  });

  it("問題なし: 対象は変更せず、通知も送らない", async () => {
    await act("no_issue", "確認したが問題なし");
    expect(effects).toEqual([]);
    expect(reportUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: "no_issue" }));
    expect(notificationInsert).not.toHaveBeenCalled();
  });

  it("ユーザーへの対応はアカウントの一時停止に読み替える（被通報者へ通知しない）", async () => {
    state.report = { ...state.report!, target_type: "user", target_id: "bad-user" };
    await act("delete", "なりすまし");
    expect(effects).toEqual(["users.update:suspended_at"]);
    const recipients = notificationInsert.mock.calls.map((call) => (call as unknown as [{ user_id: string }])[0].user_id);
    expect(recipients).toEqual(["reporter"]);
    expect(recipients).not.toContain("bad-user");
  });

  it("不正な操作は400、非管理者は404", async () => {
    expect((await act("bogus")).status).toBe(400);
    state.isAdmin = false;
    expect((await act("hide")).status).toBe(404);
  });

  it("strike-system Task 2: 非公開化・削除は理由が空だと 400 で、何もしない", async () => {
    const response = await act("hide", "");
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "note_required" });
    expect(effects).toEqual([]);
    expect(applyStrikeForReport).not.toHaveBeenCalled();
  });

  it("strike-system Task 2: 確定で投稿者にストライクを付け、応答に段階を返す。問題なしでは付けない", async () => {
    const response = await act("hide", "不適切");
    expect(applyStrikeForReport).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ adminId: "admin-1", posterId: "bad", reportId: "r1", action: "hide", note: "不適切" })
    );
    expect((await response.json()).strike).toEqual({ activeCount: 1, measure: { kind: "warn" }, severe: false });
    applyStrikeForReport.mockClear();
    await act("no_issue");
    expect(applyStrikeForReport).not.toHaveBeenCalled();
  });
});
