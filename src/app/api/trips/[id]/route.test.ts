import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 出典: docs/tasks/records/album/01-album-detail-handler.md 単体テスト
 * - アルバムメンバーでないユーザーからのリクエストが拒否されることを検証する
 * - メンバーには、対象旅行の非公開投稿を含む全投稿が返ることを検証する
 */
const state = { user: { id: "me" } as { id: string } | null, myRole: "viewer" as string | null };

const posts = [
  { id: "pub", spot_id: "s", user_id: "owner", category: "グルメ", visit_date: null, duration: null, cost: null, rating: null, comment: null, visibility: "public", created_at: "2026-09-02T00:00:00Z", spots: { name: "A" }, users: { display_name: "o", avatar_url: null }, post_photos: [], likes: [{ count: 0 }], comments: [{ count: 0 }] },
  { id: "priv", spot_id: "s", user_id: "owner", category: "グルメ", visit_date: null, duration: null, cost: null, rating: null, comment: null, visibility: "private", created_at: "2026-09-01T00:00:00Z", spots: { name: "A" }, users: { display_name: "o", avatar_url: null }, post_photos: [], likes: [{ count: 0 }], comments: [{ count: 0 }] },
];

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: state.user }, error: null }) } }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const q: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in", "order", "is"]) q[m] = () => q;
      q.maybeSingle = async () => ({
        data:
          table === "trips"
            ? { id: "trip-1", title: "夏旅", user_id: "owner" }
            : table === "album_members"
              ? state.myRole && { role: state.myRole }
              : null,
        error: null,
      });
      q.then = (resolve: (v: unknown) => void) =>
        resolve({
          data:
            table === "posts"
              ? posts
              : table === "album_members"
                ? [{ user_id: "owner", role: "owner", joined_at: "2026-09-01T00:00:00Z", users: { display_name: "o", avatar_url: null, is_deleted: false } }]
                : [],
          error: null,
        });
      return q;
    },
    storage: { from: () => ({ createSignedUrls: async () => ({ data: [], error: null }) }) },
  }),
}));

import { GET } from "./route";
const get = () => GET(new Request("http://localhost"), { params: Promise.resolve({ id: "trip-1" }) });

beforeEach(() => {
  state.user = { id: "me" };
  state.myRole = "viewer";
});

describe("GET /api/trips/[id]", () => {
  it("メンバーには非公開投稿を含む全投稿と旅行タイトルが返る", async () => {
    const response = await get();
    expect(response.status).toBe(200);
    const { album } = await response.json();
    expect(album.title).toBe("夏旅");
    expect(album.viewerRole).toBe("viewer");
    expect(album.posts.map((post: { id: string; visibility: string }) => [post.id, post.visibility])).toEqual([
      ["pub", "public"],
      ["priv", "private"],
    ]);
    expect(album.posts[0].tripTitle).toBe("夏旅");
  });

  it("メンバーでなければ404", async () => {
    state.myRole = null;
    expect((await get()).status).toBe(404);
  });

  it("未ログインは401", async () => {
    state.user = null;
    expect((await get()).status).toBe(401);
  });
});
