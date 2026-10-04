import { describe, expect, it, vi } from "vitest";
import { findSavedSpotIds } from "./saved-spots";

/**
 * 出典: #696（保存済みのスポットでは「＋」をチェックにする）単体テスト
 * 要件定義書 3.6.4・ワイヤーフレーム決定事項 76
 *
 * 【初心者向け】いちばん大事なのは「**しおりに入れたスポットも保存済みにする**」こと。
 * 前は「行きたい」しか見ておらず、しおりに入れた場所が「まだ保存していない」ように見えていた。
 */
function stubAdmin(wishlistRows: { spot_id: string }[], itineraryRows: { spot_id: string }[] | null) {
  const wishlist = {
    select: () => ({ eq: () => ({ in: async () => ({ data: wishlistRows, error: null }) }) }),
  };
  const itinerarySpots = {
    select: () => ({
      in: () => ({
        eq: async () => (itineraryRows === null ? { data: null, error: new Error("boom") } : { data: itineraryRows, error: null }),
      }),
    }),
  };
  return {
    from: vi.fn((table: string) => (table === "wishlist" ? wishlist : itinerarySpots)),
  } as never;
}

describe("findSavedSpotIds", () => {
  it("「行きたい」に入っていれば保存済み", async () => {
    const saved = await findSavedSpotIds(stubAdmin([{ spot_id: "a" }], []), "me", ["a", "b"]);
    expect([...saved]).toEqual(["a"]);
  });

  it("「しおり」に入っていても保存済み（前は見ていなかった）", async () => {
    const saved = await findSavedSpotIds(stubAdmin([], [{ spot_id: "b" }]), "me", ["a", "b"]);
    expect([...saved]).toEqual(["b"]);
  });

  it("両方に入っていても 1 つ", async () => {
    const saved = await findSavedSpotIds(stubAdmin([{ spot_id: "a" }], [{ spot_id: "a" }]), "me", ["a"]);
    expect([...saved]).toEqual(["a"]);
  });

  it("どちらにも無ければ空", async () => {
    const saved = await findSavedSpotIds(stubAdmin([], []), "me", ["a"]);
    expect(saved.size).toBe(0);
  });

  it("スポットが 0 件なら問い合わせない", async () => {
    const admin = stubAdmin([], []);
    const saved = await findSavedSpotIds(admin, "me", []);
    expect(saved.size).toBe(0);
    expect((admin as unknown as { from: ReturnType<typeof vi.fn> }).from).not.toHaveBeenCalled();
  });

  /**
   * しおり側が引けなくても画面は壊さない（✓ が出ないだけ）。
   * 「行きたい」側が引けないときは、数え間違いを隠さず落とす。
   */
  it("しおり側が引けなくても「行きたい」だけで答える", async () => {
    const saved = await findSavedSpotIds(stubAdmin([{ spot_id: "a" }], null), "me", ["a"]);
    expect([...saved]).toEqual(["a"]);
  });
});
