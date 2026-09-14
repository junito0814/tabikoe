import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { canViewPost, getPostDetail, presentAuthor } from "./post-detail";

/**
 * 出典: docs/tasks/browsing/post-detail-view/01-post-detail-handler.md 単体テスト
 * - 公開投稿を、投稿者本人・第三者どちらのリクエストでも取得できることを検証する
 * - 非公開投稿を、投稿者本人・アルバムメンバーのリクエストで取得できることを検証する
 * - 非公開投稿を、投稿者でもアルバムメンバーでもない第三者のリクエストで404が返ることを検証する
 * - 退会済みユーザーの投稿で、投稿者名が匿名化されて返ることを検証する
 */
vi.mock("@/lib/blocks/get-blocked-user-ids", () => ({
  isBlockedEitherWay: vi.fn(async () => false),
}));

describe("canViewPost", () => {
  it("公開投稿は本人・第三者どちらでも閲覧できる", () => {
    const post = { user_id: "owner", visibility: "public" };
    expect(canViewPost(post, "owner", false)).toBe(true);
    expect(canViewPost(post, "stranger", false)).toBe(true);
  });

  it("非公開投稿は本人・アルバムメンバーなら閲覧できる", () => {
    const post = { user_id: "owner", visibility: "private" };
    expect(canViewPost(post, "owner", false)).toBe(true);
    expect(canViewPost(post, "member", true)).toBe(true);
  });

  it("非公開投稿は本人でもメンバーでもない第三者には見せない", () => {
    expect(canViewPost({ user_id: "owner", visibility: "private" }, "stranger", false)).toBe(false);
  });
});

describe("presentAuthor", () => {
  it("退会済みユーザーは投稿者名・アイコンを匿名化する", () => {
    expect(
      presentAuthor({ id: "u", display_name: "本名", avatar_url: "https://x/a.jpg", is_deleted: true })
    ).toEqual({ id: "u", displayName: "退会済みユーザー", avatarUrl: "/default-avatar.svg", isDeleted: true });
  });

  it("通常ユーザーはそのまま", () => {
    expect(presentAuthor({ id: "u", display_name: "たろう", avatar_url: null, is_deleted: false })).toEqual({
      id: "u",
      displayName: "たろう",
      avatarUrl: "/default-avatar.svg",
      isDeleted: false,
    });
  });
});

/** posts → album_members → likes/comments/wishlist の問い合わせを最小限に模す */
function fakeAdmin(post: Record<string, unknown> | null, membership: boolean) {
  const chain = (result: unknown) => {
    const q: Record<string, unknown> = {};
    for (const method of ["select", "eq", "order", "in"]) q[method] = () => q;
    q.maybeSingle = async () => ({ data: result, error: null });
    q.then = (resolve: (value: unknown) => void) => resolve({ data: result, error: null, count: 0 });
    return q;
  };
  return {
    from: (table: string) => {
      if (table === "posts") return chain(post);
      if (table === "album_members") return chain(membership ? { id: "m" } : null);
      return chain(null);
    },
    storage: { from: () => ({ createSignedUrls: async () => ({ data: [], error: null }) }) },
  } as unknown as SupabaseClient;
}

const privatePost = {
  id: "p1",
  user_id: "owner",
  trip_id: "t1",
  spot_id: "s1",
  category: "グルメ",
  visit_date: null,
  duration: null,
  cost: null,
  rating: 3,
  comment: null,
  visibility: "private",
  created_at: "2026-09-01T00:00:00Z",
  spots: { id: "s1", name: "東京駅", prefecture: "東京都" },
  users: { id: "owner", display_name: "たろう", avatar_url: null, is_deleted: false },
  post_photos: [],
};

describe("getPostDetail", () => {
  it("非公開投稿は本人・アルバムメンバーなら取得できる", async () => {
    expect(await getPostDetail(fakeAdmin(privatePost, false), "owner", "p1")).toMatchObject({
      id: "p1",
      isOwner: true,
      canInteract: false,
    });
    expect(await getPostDetail(fakeAdmin(privatePost, true), "member", "p1")).toMatchObject({
      id: "p1",
      isOwner: false,
    });
  });

  it("非公開投稿は第三者には null（404）", async () => {
    expect(await getPostDetail(fakeAdmin(privatePost, false), "stranger", "p1")).toBeNull();
  });

  it("存在しない投稿は null", async () => {
    expect(await getPostDetail(fakeAdmin(null, false), "owner", "p1")).toBeNull();
  });

  it("退会済みユーザーの投稿は投稿者名が匿名化される", async () => {
    const post = {
      ...privatePost,
      visibility: "public",
      users: { id: "owner", display_name: "本名", avatar_url: "https://x/a.jpg", is_deleted: true },
    };
    const detail = await getPostDetail(fakeAdmin(post, false), "stranger", "p1");
    expect(detail?.author.displayName).toBe("退会済みユーザー");
    expect(detail?.author.avatarUrl).toBe("/default-avatar.svg");
    expect(detail?.canInteract).toBe(true);
  });
});
