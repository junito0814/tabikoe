import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getWishlistItems } from "./get-wishlist-items";
import { resolveWishlistThumbnail, SPOT_PLACEHOLDER_IMAGE_URL } from "./constants";

/**
 * 出典: docs/tasks/records/wishlist/02-wishlist-list-screen.md 単体テスト
 * - 投稿がないスポットに対し、プレースホルダ画像のパスが返ること
 */
vi.mock("@/lib/blocks/get-blocked-user-ids", () => ({
  getBlockedUserIds: vi.fn(async () => []),
}));

describe("resolveWishlistThumbnail", () => {
  it("投稿写真が無ければプレースホルダのパスを返す", () => {
    expect(resolveWishlistThumbnail(undefined)).toEqual({
      thumbnailUrl: SPOT_PLACEHOLDER_IMAGE_URL,
      hasPost: false,
    });
    expect(resolveWishlistThumbnail(null).thumbnailUrl).toBe("/spot-placeholder.svg");
  });

  it("投稿写真があればそのURLを返す", () => {
    expect(resolveWishlistThumbnail("https://example.com/p.jpg")).toEqual({
      thumbnailUrl: "https://example.com/p.jpg",
      hasPost: true,
    });
  });
});

/**
 * wishlist → posts の2回の問い合わせと、storage の署名付きURL発行だけを模す。
 */
function fakeAdmin({
  wishlistRows,
  postRows,
}: {
  wishlistRows: unknown[];
  postRows: unknown[];
}) {
  const wishlistQuery = {
    select: () => wishlistQuery,
    eq: () => wishlistQuery,
    order: async () => ({ data: wishlistRows, error: null }),
  };
  const postsQuery = {
    select: () => postsQuery,
    in: () => postsQuery,
    or: () => postsQuery,
    not: () => postsQuery,
    order: async () => ({ data: postRows, error: null }),
  };
  const createSignedUrls = vi.fn(async (paths: string[]) => ({
    data: paths.map((path) => ({ path, signedUrl: `signed:${path}` })),
    error: null,
  }));

  return {
    from: (table: string) => (table === "wishlist" ? wishlistQuery : postsQuery),
    storage: { from: () => ({ createSignedUrls }) },
  } as unknown as SupabaseClient;
}

const spotA = { id: "spot-a", name: "A", prefecture: "東京都", lat: 35, lng: 139 };
const spotB = { id: "spot-b", name: "B", prefecture: null, lat: 34, lng: 135 };

describe("getWishlistItems", () => {
  it("投稿ありのスポットは写真、投稿なしのスポットはプレースホルダになる", async () => {
    const admin = fakeAdmin({
      wishlistRows: [
        { spot_id: "spot-a", created_at: "2026-09-12T00:00:00Z", spot: spotA },
        { spot_id: "spot-b", created_at: "2026-09-11T00:00:00Z", spot: spotB },
      ],
      postRows: [
        {
          spot_id: "spot-a",
          user_id: "other",
          created_at: "2026-09-10T00:00:00Z",
          post_photos: [
            { storage_url: "a/2.jpg", media_type: "photo", display_order: 1 },
            { storage_url: "a/1.jpg", media_type: "photo", display_order: 0 },
          ],
        },
      ],
    });

    const items = await getWishlistItems(admin, "me");

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      spotId: "spot-a",
      name: "A",
      hasPost: true,
      thumbnailUrl: "signed:a/1.jpg", // display_order が最小の写真
    });
    expect(items[1]).toMatchObject({
      spotId: "spot-b",
      name: "B",
      prefecture: null,
      hasPost: false,
      thumbnailUrl: SPOT_PLACEHOLDER_IMAGE_URL,
    });
  });

  it("保存が無ければ空配列（投稿の問い合わせも署名も行わない）", async () => {
    const admin = fakeAdmin({ wishlistRows: [], postRows: [] });
    expect(await getWishlistItems(admin, "me")).toEqual([]);
  });
});
