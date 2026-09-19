import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  awardBadges,
  awardLikeCountBadgeIfEligible,
  countReceivedLikes,
  evaluatePostBadges,
} from "./award-badges";

/**
 * 出典: docs/tasks/badges/status-badges/02-post-count-prefecture-badge-evaluation.md 単体テスト
 *       docs/tasks/badges/status-badges/03-like-count-badge-evaluation.md 単体テスト
 *
 * badges への upsert（ignoreDuplicates）は「既に持っている badge_type は返さない」という
 * DBの挙動を模し、投稿数・いいね数の集計は count を直接返す。
 */
function fakeAdmin({
  postCount = 0,
  likeCount = 0,
  owned = [] as string[],
  spotCount = 0,
}: {
  postCount?: number;
  likeCount?: number;
  owned?: string[];
  /** v3.2: 自分が登録した manual スポットの数 */
  spotCount?: number;
}) {
  const upsert = vi.fn((rows: { badge_type: string }[]) => ({
    select: async () => ({
      data: rows.filter((row) => !owned.includes(row.badge_type)).map((row) => ({ badge_type: row.badge_type })),
      error: null,
    }),
  }));

  const likesEq = vi.fn(() => ({ neq: likesNeq }));
  const likesNeq = vi.fn(async () => ({ count: likeCount, error: null }));

  const admin = {
    from: (table: string) => {
      if (table === "badges") return { upsert };
      if (table === "posts") {
        // v3.0: user_id と status（published）の 2 段の eq
        const query = { eq: () => query, then: (resolve: (v: unknown) => void) => resolve({ count: postCount, error: null }) };
        return { select: () => query };
      }
      if (table === "likes") return { select: () => ({ eq: likesEq }) };
      if (table === "spots") {
        // v3.2: created_by・source・posts.user_id・posts.status の 4 段の eq
        const query = { eq: () => query, then: (resolve: (v: unknown) => void) => resolve({ count: spotCount, error: null }) };
        return { select: () => query };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as unknown as SupabaseClient;

  return { admin, upsert, likesNeq };
}

describe("evaluatePostBadges（投稿数・都道府県）", () => {
  it("投稿数が9→10件になると post_count:10 が付与される", async () => {
    const { admin } = fakeAdmin({ postCount: 10, owned: ["post_count:1", "prefecture:東京都"] });
    const awarded = await evaluatePostBadges(admin, "me", "東京都");
    expect(awarded).toEqual(["post_count:10"]);
  });

  it("投稿数が10→11件になっても新たなバッジは付与されない", async () => {
    const { admin } = fakeAdmin({
      postCount: 11,
      owned: ["post_count:1", "post_count:10", "prefecture:東京都"],
    });
    expect(await evaluatePostBadges(admin, "me", "東京都")).toEqual([]);
  });

  it("初投稿では post_count:1 と都道府県バッジを同時に獲得する（判定順）", async () => {
    const { admin } = fakeAdmin({ postCount: 1 });
    expect(await evaluatePostBadges(admin, "me", "沖縄県")).toEqual([
      "post_count:1",
      "prefecture:沖縄県",
    ]);
  });

  it("v3.2: 自分が登録した manual スポットが 3 件なら spot_registration:1・3 が付き、5 は付かない。0 件なら付かない", async () => {
    const { admin } = fakeAdmin({ postCount: 5, spotCount: 3, owned: ["post_count:1", "prefecture:東京都"] });
    expect(await evaluatePostBadges(admin, "me", "東京都")).toEqual(["spot_registration:1", "spot_registration:3"]);
    const none = fakeAdmin({ postCount: 5, spotCount: 0, owned: ["post_count:1", "prefecture:東京都"] });
    expect(await evaluatePostBadges(none.admin, "me", "東京都")).toEqual([]);
  });

  it("同一都道府県への2件目の投稿では都道府県バッジが重複付与されない", async () => {
    const { admin, upsert } = fakeAdmin({ postCount: 2, owned: ["post_count:1", "prefecture:沖縄県"] });
    expect(await evaluatePostBadges(admin, "me", "沖縄県")).toEqual([]);
    // 候補には入るが、一意制約（ignoreDuplicates）で新規扱いにならない
    expect(upsert.mock.calls[0][0].map((row) => row.badge_type)).toContain("prefecture:沖縄県");
  });

  it("spots.prefecture が未設定なら都道府県バッジの判定をスキップする", async () => {
    const { admin, upsert } = fakeAdmin({ postCount: 3, owned: ["post_count:1"] });
    expect(await evaluatePostBadges(admin, "me", null)).toEqual([]);
    const candidates = upsert.mock.calls[0][0].map((row) => row.badge_type);
    expect(candidates.some((type) => type.startsWith("prefecture:"))).toBe(false);
  });
});

describe("awardLikeCountBadgeIfEligible（いいね数）", () => {
  it("累計いいね数が49→50件になると like_count:50 が付与される", async () => {
    const { admin } = fakeAdmin({ owned: ["like_count:1", "like_count:10"] });
    expect(await awardLikeCountBadgeIfEligible(admin, "author", 50)).toEqual(["like_count:50"]);
  });

  it("累計いいね数が50→51件になっても新たなバッジは付与されない", async () => {
    const { admin } = fakeAdmin({ owned: ["like_count:1", "like_count:10", "like_count:50"] });
    expect(await awardLikeCountBadgeIfEligible(admin, "author", 51)).toEqual([]);
  });

  it("閾値未到達（0件）では upsert 自体を行わない", async () => {
    const { admin, upsert } = fakeAdmin({});
    expect(await awardLikeCountBadgeIfEligible(admin, "author", 0)).toEqual([]);
    expect(upsert).not.toHaveBeenCalled();
  });
});

describe("countReceivedLikes", () => {
  it("自分自身の投稿への自分のいいねは集計から除く（user_id <> 投稿者 で絞る）", async () => {
    const { admin, likesNeq } = fakeAdmin({ likeCount: 7 });
    expect(await countReceivedLikes(admin, "author")).toBe(7);
    expect(likesNeq).toHaveBeenCalledWith("user_id", "author");
  });
});

describe("awardBadges", () => {
  it("候補が空なら何もしない", async () => {
    const { admin, upsert } = fakeAdmin({});
    expect(await awardBadges(admin, "me", [])).toEqual([]);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("同じ badge_type が重複して渡されても1行にまとめる", async () => {
    const { admin, upsert } = fakeAdmin({});
    await awardBadges(admin, "me", ["post_count:1", "post_count:1"]);
    expect(upsert.mock.calls[0][0]).toHaveLength(1);
  });
});
