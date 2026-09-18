import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getMyPageSummary, getMyPosts, matchesTripFilter } from "./my-page";

/**
 * 出典: docs/tasks/records/my-page/02-summary-aggregation-handler.md 単体テスト
 * - 投稿数・獲得いいね総数の集計クエリが、非公開投稿を含めて正しく件数を返すことを検証する
 * 出典: docs/tasks/records/my-page/03-my-posts-list-handler.md 単体テスト
 * - trip_id 指定時に、当該旅行の投稿のみが返ることを検証する
 */
describe("getMyPageSummary", () => {
  it("posts は visibility で絞らず user_id と status（下書き除外）で数え、likes は自分の投稿群で数える", async () => {
    const filters: Record<string, [string, unknown][]> = {};
    const admin = {
      from: (table: string) => {
        const q: Record<string, unknown> = {};
        q.select = () => q;
        q.eq = (column: string, value: unknown) => {
          (filters[table] ??= []).push([column, value]);
          return q;
        };
        q.then = (resolve: (v: unknown) => void) =>
          resolve({ count: table === "posts" ? 7 : 12, error: null });
        return q;
      },
    } as unknown as SupabaseClient;

    const summary = await getMyPageSummary(admin, "me");
    expect(summary).toEqual({ postCount: 7, receivedLikeCount: 12 });
    expect(filters.posts).toEqual([["user_id", "me"], ["status", "published"]]);
    expect(filters.posts.some(([column]) => column === "visibility")).toBe(false);
    expect(filters.likes).toEqual([["post.user_id", "me"]]);
  });
});

describe("matchesTripFilter", () => {
  it("trip_id 指定時は一致する投稿だけ、未指定なら全投稿", () => {
    expect(matchesTripFilter({ trip_id: "t1" }, "t1")).toBe(true);
    expect(matchesTripFilter({ trip_id: "t2" }, "t1")).toBe(false);
    expect(matchesTripFilter({ trip_id: "t2" }, null)).toBe(true);
  });
});

describe("getMyPosts", () => {
  const row = (id: string, tripId: string, visibility: string) => ({
    id,
    spot_id: "s",
    user_id: "me",
    trip_id: tripId,
    category: "グルメ",
    visit_date: null,
    duration: null,
    cost: null,
    rating: null,
    comment: null,
    visibility,
    created_at: "2026-09-01T00:00:00Z",
    spots: { name: "A" },
    users: { display_name: "me", avatar_url: null },
    trips: { title: tripId === "t1" ? "夏旅" : "冬旅" },
    post_photos: [],
    likes: [{ count: 0 }],
    comments: [{ count: 0 }],
  });
  const all = [row("a", "t1", "public"), row("b", "t2", "private"), row("c", "t1", "private")];

  function fakeAdmin() {
    let tripFilter: string | null = null;
    const q: Record<string, unknown> = {};
    for (const m of ["select", "order", "range", "in"]) q[m] = () => q;
    q.eq = (column: string, value: string) => {
      if (column === "trip_id") tripFilter = value;
      return q;
    };
    q.then = (resolve: (v: unknown) => void) => {
      const rows = all.filter((r) => tripFilter === null || r.trip_id === tripFilter);
      resolve({ data: rows, error: null, count: rows.length });
    };
    return {
      from: (table: string) =>
        table === "likes" ? { select: () => ({ eq: () => ({ in: async () => ({ data: [], error: null }) }) }) } : q,
      storage: { from: () => ({ createSignedUrls: async () => ({ data: [], error: null }) }) },
    } as unknown as SupabaseClient;
  }

  it("trip_id 指定時は当該旅行の投稿のみ（非公開含む）で、旅行タイトルが付く", async () => {
    const page = await getMyPosts(fakeAdmin(), "me", "t1", 0);
    expect(page.posts.map((post) => [post.id, post.visibility, post.tripTitle])).toEqual([
      ["a", "public", "夏旅"],
      ["c", "private", "夏旅"],
    ]);
    expect(page.nextOffset).toBeNull();
  });

  it("未指定なら全投稿", async () => {
    const page = await getMyPosts(fakeAdmin(), "me", null, 0);
    expect(page.posts).toHaveLength(3);
  });
});
