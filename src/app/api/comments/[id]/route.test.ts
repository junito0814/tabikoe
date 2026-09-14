import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 出典: docs/tasks/browsing/comments/02-comment-delete-handler.md 単体テスト
 * - コメント投稿者本人からの削除リクエストが成功することを検証する
 * - 投稿者本人以外（投稿の投稿者やアルバムオーナーを含む）からの削除リクエストが拒否されることを検証する
 */
const state = {
  user: { id: "me" } as { id: string } | null,
  comment: { id: "c1", user_id: "me", post_id: "p1" } as { id: string; user_id: string; post_id: string } | null,
};

const deleteEq = vi.fn(async () => ({ error: null }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user }, error: null }) },
    from: () => ({ delete: () => ({ eq: deleteEq }) }),
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "operation_logs") return { insert: async () => ({ error: null }) };
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.comment, error: null }) }) }),
      };
    },
  }),
}));

import { DELETE } from "./route";

const del = () =>
  DELETE(new Request("http://localhost/api/comments/c1", { method: "DELETE" }), {
    params: Promise.resolve({ id: "c1" }),
  });

beforeEach(() => {
  state.user = { id: "me" };
  state.comment = { id: "c1", user_id: "me", post_id: "p1" };
  deleteEq.mockClear();
});

describe("DELETE /api/comments/[id]", () => {
  it("本人からの削除は成功する", async () => {
    const response = await del();
    expect(response.status).toBe(200);
    expect(deleteEq).toHaveBeenCalledWith("id", "c1");
  });

  it("本人以外（投稿の投稿者・アルバムオーナーを含む）からの削除は403", async () => {
    state.comment = { id: "c1", user_id: "someone-else", post_id: "p1" };
    expect((await del()).status).toBe(403);
    expect(deleteEq).not.toHaveBeenCalled();
  });

  it("存在しないコメントは404", async () => {
    state.comment = null;
    expect((await del()).status).toBe(404);
  });

  it("未ログインは401", async () => {
    state.user = null;
    expect((await del()).status).toBe(401);
  });
});
