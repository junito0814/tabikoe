import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 出典: docs/tasks/browsing/comments/01-comment-create-handler.md 単体テスト
 * - 非公開投稿へのアクセス権がないユーザーからのコメント投稿が拒否されることを検証する
 * 出典: docs/tasks/browsing/comments/04-comment-rate-limiting.md 単体テスト
 * - 境界値（5件目：許可、6件目：拒否）の挙動を検証する（check_rate_limit の結果に応じて 429 を返す。
 *   窓の判定自体は DB 関数側で、結合テストの対象）
 * 出典: docs/tasks/browsing/comments/05-comment-notification-integration.md 単体テスト
 * - 自分以外のユーザーの投稿にコメントした場合、投稿者への通知が1件作成されることを検証する
 * - 自分自身の投稿にコメントした場合、通知が作成されないことを検証する
 */
const state = {
  user: { id: "me" } as { id: string } | null,
  post: { id: "p1", user_id: "author", visibility: "public" } as { id: string; user_id: string; visibility: string } | null,
  rateLimitAllowed: true,
};

const insert = vi.fn(() => ({
  select: () => ({
    single: async () => ({
      data: { id: "c1", user_id: "me", body: "hi", created_at: "2026-09-14T00:00:00Z" },
      error: null,
    }),
  }),
}));
const notificationInsert = vi.fn(async () => ({ error: null }));
const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
  if (name === "check_rate_limit") {
    return { data: state.rateLimitAllowed, error: null, args };
  }
  return { data: null, error: null };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user }, error: null }) },
    from: () => ({ insert }),
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc,
    from: (table: string) => {
      if (table === "notifications") return { insert: notificationInsert };
      if (table === "operation_logs") return { insert: async () => ({ error: null }) };
      const q: Record<string, unknown> = {};
      for (const m of ["select", "eq"]) q[m] = () => q;
      q.maybeSingle = async () => ({
        data: table === "posts" ? state.post : { display_name: "me", avatar_url: null, is_deleted: false },
        error: null,
      });
      return q;
    },
  }),
}));

vi.mock("@/lib/blocks/get-blocked-user-ids", () => ({ isBlockedEitherWay: async () => false }));

import { POST } from "./route";

const params = { params: Promise.resolve({ id: "p1" }) };
const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/posts/p1/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    params
  );

beforeEach(() => {
  state.user = { id: "me" };
  state.post = { id: "p1", user_id: "author", visibility: "public" };
  state.rateLimitAllowed = true;
  insert.mockClear();
  notificationInsert.mockClear();
  rpc.mockClear();
});

describe("POST /api/posts/[id]/comments", () => {
  it("公開投稿にコメントを保存し、エスケープ済み本文で登録する（201）", async () => {
    const response = await post({ body: "<b>こんにちは</b>" });
    expect(response.status).toBe(201);
    expect(insert).toHaveBeenCalledWith({ post_id: "p1", user_id: "me", body: "&lt;b&gt;こんにちは&lt;/b&gt;" });
  });

  it("非公開投稿へのコメントは拒否される（403）", async () => {
    state.post = { id: "p1", user_id: "author", visibility: "private" };
    expect((await post({ body: "hi" })).status).toBe(403);
    expect(insert).not.toHaveBeenCalled();
  });

  it("存在しない投稿は404", async () => {
    state.post = null;
    expect((await post({ body: "hi" })).status).toBe(404);
  });

  it("空・長すぎる本文は400", async () => {
    expect((await post({ body: "" })).status).toBe(400);
    expect((await post({ body: "あ".repeat(4001) })).status).toBe(400);
  });

  it("レート制限（1分間5件）を check_rate_limit に渡し、超過なら429", async () => {
    await post({ body: "hi" });
    expect(rpc).toHaveBeenCalledWith("check_rate_limit", {
      p_subject: "me",
      p_action_type: "comment_create",
      p_window_seconds: 60,
      p_limit: 5,
    });

    state.rateLimitAllowed = false;
    const response = await post({ body: "6件目" });
    expect(response.status).toBe(429);
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it("他人の投稿へのコメントで投稿者に通知が1件作られる（related_id はコメントID）", async () => {
    await post({ body: "hi" });
    expect(notificationInsert).toHaveBeenCalledTimes(1);
    expect(notificationInsert).toHaveBeenCalledWith({
      user_id: "author",
      type: "comment",
      related_id: "c1",
      is_read: false,
    });
  });

  it("自分の投稿へのコメントでは通知を作らない", async () => {
    state.post = { id: "p1", user_id: "me", visibility: "public" };
    expect((await post({ body: "hi" })).status).toBe(201);
    expect(notificationInsert).not.toHaveBeenCalled();
  });

  it("未ログインは401", async () => {
    state.user = null;
    expect((await post({ body: "hi" })).status).toBe(401);
  });
});
