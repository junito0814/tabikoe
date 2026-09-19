import { describe, expect, it } from "vitest";
import { parsePostSort, sortPostCards, toPostCard, type PostCardRow } from "./post-cards";

/**
 * 出典: docs/tasks/map-search/pin-interaction/01-spot-posts-handler.md 単体テスト
 * - 新着順・評価順・いいね順それぞれの並び替えロジックを検証する
 * - 非公開投稿が結果に含まれないことを検証する（可視性は DB 側の visibility=public 条件で絞る。
 *   ここでは並び替え・整形を検証し、Route Handler の分岐は route.test.ts で確認する）
 */
const card = (id: string, createdAt: string, rating: number | null, likeCount: number) => ({
  id,
  createdAt,
  rating,
  likeCount,
});

describe("sortPostCards", () => {
  const cards = [
    card("a", "2026-09-01T00:00:00Z", 3, 5),
    card("b", "2026-09-03T00:00:00Z", 5, 1),
    card("c", "2026-09-02T00:00:00Z", null, 9),
    card("d", "2026-09-04T00:00:00Z", 5, 1),
  ];

  it("新着順は投稿日時が新しい順", () => {
    expect(sortPostCards(cards, "newest").map((c) => c.id)).toEqual(["d", "b", "c", "a"]);
  });

  it("評価順は星が高い順、同点は新しい順、未評価は末尾", () => {
    expect(sortPostCards(cards, "rating").map((c) => c.id)).toEqual(["d", "b", "a", "c"]);
  });

  it("いいね順はいいね数が多い順、同数は新しい順", () => {
    expect(sortPostCards(cards, "likes").map((c) => c.id)).toEqual(["c", "a", "d", "b"]);
  });

  it("元の配列を変更しない", () => {
    const copy = [...cards];
    sortPostCards(cards, "likes");
    expect(cards).toEqual(copy);
  });
});

describe("parsePostSort", () => {
  it("既定は新着順、不正値も新着順", () => {
    expect(parsePostSort(null)).toBe("newest");
    expect(parsePostSort("unknown")).toBe("newest");
    expect(parsePostSort("rating")).toBe("rating");
    expect(parsePostSort("likes")).toBe("likes");
  });
});

describe("toPostCard", () => {
  const row: PostCardRow = {
    id: "p1",
    spot_id: "s1",
    user_id: "u1",
    category: "グルメ",
    visit_date: "2026-09-01",
    duration: "1時間以内",
    cost: 1200,
    rating: 4,
    comment: "とても良かった",
    created_at: "2026-09-02T00:00:00Z",
    spots: { name: "東京駅" },
    users: { display_name: "たろう", avatar_url: null },
    post_photos: [
      { storage_url: "u1/p1/second.jpg", media_type: "photo", display_order: 1 },
      { storage_url: "u1/p1/first.jpg", media_type: "photo", display_order: 0 },
    ],
    likes: [{ count: 3 }],
    comments: [{ count: 2 }],
  };

  it("代表画像は display_order が最小の1点で、署名付きURLに置き換える", () => {
    const result = toPostCard(row, new Map([["u1/p1/first.jpg", "signed:first"]]));
    expect(result.thumbnailUrl).toBe("signed:first");
    expect(result.thumbnailMediaType).toBe("photo");
    expect(result.mediaCount).toBe(2);
    expect(result.likeCount).toBe(3);
    expect(result.commentCount).toBe(2);
    expect(result.author).toEqual({ id: "u1", displayName: "たろう", avatarUrl: "/default-avatar.svg" });
    expect(result.spotName).toBe("東京駅");
  });

  it("感想は冒頭80文字で切り、超えたら省略記号を付ける", () => {
    const long = "あ".repeat(100);
    const result = toPostCard({ ...row, comment: long }, new Map());
    expect(result.commentExcerpt).toBe("あ".repeat(80) + "…");
    expect(toPostCard(row, new Map()).commentExcerpt).toBe("とても良かった");
  });
});

describe("commentExcerpt（v3.2）", () => {
  it("冒頭 1 行だけ、エスケープを戻す", async () => {
    const { commentExcerpt } = await import("./post-cards");
    expect(commentExcerpt("&lt;b&gt;行列&lt;/b&gt;すごかった\n2 行目")).toBe("<b>行列</b>すごかった");
  });
});
