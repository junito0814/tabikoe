import { describe, expect, it } from "vitest";
import {
  BADGE_CATALOG,
  badgeTypeForLikeCount,
  badgeTypeForPostCount,
  badgeTypeForPrefecture,
  findBadgeDefinition,
  PREFECTURES,
  reachedLikeCountBadgeTypes,
  reachedPostCountBadgeTypes,
} from "./catalog";

/**
 * 出典: docs/tasks/badges/status-badges/01-badge-catalog-definition.md 単体テスト
 * - 都道府県名・投稿数閾値・いいね数閾値それぞれについて正しい badge_type が生成されること
 * - 閾値に含まれない中間の数値（例: 投稿数5件）には該当バッジが存在しないこと
 */
describe("badge_type の生成", () => {
  it("都道府県バッジは prefecture:<都道府県名>", () => {
    expect(badgeTypeForPrefecture("東京都")).toBe("prefecture:東京都");
    expect(badgeTypeForPrefecture("北海道")).toBe("prefecture:北海道");
  });

  it("47都道府県以外（未設定・国外の地名）は都道府県バッジにならない", () => {
    expect(badgeTypeForPrefecture(null)).toBeNull();
    expect(badgeTypeForPrefecture(undefined)).toBeNull();
    expect(badgeTypeForPrefecture("California")).toBeNull();
    expect(PREFECTURES).toHaveLength(47);
  });

  it("投稿数バッジは閾値 1/10/50/100 で post_count:<閾値>", () => {
    expect(badgeTypeForPostCount(1)).toBe("post_count:1");
    expect(badgeTypeForPostCount(10)).toBe("post_count:10");
    expect(badgeTypeForPostCount(50)).toBe("post_count:50");
    expect(badgeTypeForPostCount(100)).toBe("post_count:100");
  });

  it("中間の投稿数（5件・11件）にはバッジが無い", () => {
    expect(badgeTypeForPostCount(5)).toBeNull();
    expect(badgeTypeForPostCount(11)).toBeNull();
    expect(badgeTypeForPostCount(0)).toBeNull();
  });

  it("いいね数バッジは閾値 1/10/50/100/200 で like_count:<閾値>", () => {
    expect(badgeTypeForLikeCount(1)).toBe("like_count:1");
    expect(badgeTypeForLikeCount(200)).toBe("like_count:200");
    expect(badgeTypeForLikeCount(150)).toBeNull();
  });

  it("到達済み閾値の一覧は件数以下の閾値をすべて含む", () => {
    expect(reachedPostCountBadgeTypes(0)).toEqual([]);
    expect(reachedPostCountBadgeTypes(5)).toEqual(["post_count:1"]);
    expect(reachedPostCountBadgeTypes(10)).toEqual(["post_count:1", "post_count:10"]);
    expect(reachedLikeCountBadgeTypes(51)).toEqual(["like_count:1", "like_count:10", "like_count:50"]);
  });
});

describe("BADGE_CATALOG", () => {
  it("投稿数4 + いいね数5 + スポット登録7（v3.2） + 都道府県47 = 63種で、type は重複しない", () => {
    expect(BADGE_CATALOG).toHaveLength(63);
    expect(new Set(BADGE_CATALOG.map((badge) => badge.type)).size).toBe(63);
    expect(BADGE_CATALOG.filter((badge) => badge.category === "spot_registration").map((badge) => badge.type)).toEqual([
      "spot_registration:1", "spot_registration:3", "spot_registration:5", "spot_registration:10", "spot_registration:20", "spot_registration:30", "spot_registration:50",
    ]);
  });

  it("badge_type から定義を引ける", () => {
    expect(findBadgeDefinition("post_count:10")?.label).toBe("投稿10件");
    expect(findBadgeDefinition("prefecture:沖縄県")?.category).toBe("prefecture");
    expect(findBadgeDefinition("unknown:1")).toBeUndefined();
  });
});
