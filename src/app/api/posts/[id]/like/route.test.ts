import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 出典: docs/tasks/browsing/likes/01-like-toggle-handler.md 単体テスト
 * - 未いいねの投稿にいいねを付与できることを検証する
 * - 既にいいね済みの投稿へ再度いいねしようとした場合、重複登録されないことを検証する
 * - いいね済みの投稿からいいねを取り消せることを検証する
 * - 非公開投稿へのいいね付与リクエストが拒否されることを検証する
 * 出典: docs/tasks/browsing/likes/02-like-notification-integration.md 単体テスト
 * - 自分以外のユーザーの投稿にいいねした場合、投稿者への通知が1件作成されることを検証する
 * - 自分自身の投稿にいいねした場合、通知が作成されないことを検証する
 */
const state = {
  user: { id: "me" } as { id: string } | null,
  post: { id: "p1", user_id: "author", visibility: "public" } as { id: string; user_id: string; visibility: string } | null,
  insertError: null as { code: string } | null,
};

const insert = vi.fn(async () => ({ error: state.insertError }));
const deleteEq2 = vi.fn(async () => ({ error: null }));
const notificationInsert = vi.fn(async () => ({ error: null }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user }, error: null }) },
    from: () => ({
      insert,
      delete: () => ({ eq: () => ({ eq: deleteEq2 }) }),
    }),
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "notifications") return { insert: notificationInsert };
      const q: Record<string, unknown> = {};
      for (const m of ["select", "eq", "neq"]) q[m] = () => q;
      q.maybeSingle = async () => ({ data: state.post, error: null });
      q.then = (resolve: (v: unknown) => void) => resolve({ data: null, error: null, count: 2 });
      return q;
    },
  }),
}));

vi.mock("@/lib/blocks/get-blocked-user-ids", () => ({ isBlockedEitherWay: async () => false }));
vi.mock("@/lib/badges/award-badges", () => ({
  countReceivedLikes: async () => 0,
  awardLikeCountBadgeIfEligible: async () => [],
}));

import { DELETE, POST } from "./route";

const params = { params: Promise.resolve({ id: "p1" }) };
const like = () => POST(new Request("http://localhost/api/posts/p1/like", { method: "POST" }), params);
const unlike = () => DELETE(new Request("http://localhost/api/posts/p1/like", { method: "DELETE" }), params);

beforeEach(() => {
  state.user = { id: "me" };
  state.post = { id: "p1", user_id: "author", visibility: "public" };
  state.insertError = null;
  insert.mockClear();
  deleteEq2.mockClear();
  notificationInsert.mockClear();
});

describe("POST /api/posts/[id]/like", () => {
  it("未いいねの投稿にいいねを付与できる（201）", async () => {
    const response = await like();
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ liked: true, alreadyLiked: false, likeCount: 2 });
    expect(insert).toHaveBeenCalledWith({ post_id: "p1", user_id: "me" });
  });

  it("いいね済みへの再付与は重複登録せず冪等に200", async () => {
    state.insertError = { code: "23505" };
    const response = await like();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ liked: true, alreadyLiked: true });
    expect(notificationInsert).not.toHaveBeenCalled();
  });

  it("非公開投稿へのいいねは拒否される（403）", async () => {
    state.post = { id: "p1", user_id: "author", visibility: "private" };
    const response = await like();
    expect(response.status).toBe(403);
    expect(insert).not.toHaveBeenCalled();
  });

  it("存在しない投稿は404", async () => {
    state.post = null;
    expect((await like()).status).toBe(404);
  });

  it("未ログインは401", async () => {
    state.user = null;
    expect((await like()).status).toBe(401);
  });

  it("他人の投稿へのいいねで投稿者に通知が1件作られる", async () => {
    await like();
    expect(notificationInsert).toHaveBeenCalledTimes(1);
    expect(notificationInsert).toHaveBeenCalledWith({
      user_id: "author",
      type: "like",
      related_id: "p1",
      is_read: false,
    });
  });

  it("自分の投稿へのいいねでは通知を作らない", async () => {
    state.post = { id: "p1", user_id: "me", visibility: "public" };
    expect((await like()).status).toBe(201);
    expect(notificationInsert).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/posts/[id]/like", () => {
  it("いいねを取り消せる", async () => {
    const response = await unlike();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ liked: false, likeCount: 2 });
    expect(deleteEq2).toHaveBeenCalledWith("user_id", "me");
  });

  it("未ログインは401", async () => {
    state.user = null;
    expect((await unlike()).status).toBe(401);
  });
});
