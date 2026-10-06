import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveDestination } from "./resolve-destination";

/**
 * 出典: docs/tasks/map-search/post-timeline/01-search-api-destination.md 単体テスト
 * - 3 通りの検索条件（都道府県・座標・スポット）で正しい行き先が組まれること
 */
function adminWithSpot(spot: Record<string, unknown> | null) {
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => ({ data: spot }),
  };
  return { from: () => query } as unknown as SupabaseClient;
}

describe("resolveDestination", () => {
  it("spot があればスポット別（非公開なら spot_missing）", async () => {
    const spot = { id: "s1", name: "たこ焼き", prefecture: "大阪府", lat: 34.7, lng: 135.5, source: "manual", hidden_at: null };
    const result = await resolveDestination(adminWithSpot(spot), { spot: "s1", pref: "大阪府" });
    expect(result.kind).toBe("spot");
    if (result.kind === "spot") expect(result.spot.name).toBe("たこ焼き");
    expect((await resolveDestination(adminWithSpot({ ...spot, hidden_at: "2026-01-01" }), { spot: "s1" })).kind).toBe("spot_missing");
  });

  it("pref は 47 都道府県のどれかに一致したときだけ", async () => {
    expect(await resolveDestination(adminWithSpot(null), { pref: "大阪府" })).toEqual({
      kind: "prefecture",
      title: "大阪府",
      destination: { kind: "prefecture", name: "大阪府" },
    });
    expect((await resolveDestination(adminWithSpot(null), { pref: "架空県" })).kind).toBe("not_found");
  });

  it("lat/lng があれば座標の周辺（q は見出し）", async () => {
    expect(await resolveDestination(adminWithSpot(null), { lat: "34.7", lng: "135.5", q: "大阪駅" })).toEqual({
      kind: "nearby",
      title: "大阪駅",
      destination: { kind: "nearby", lat: 34.7, lng: 135.5, label: "大阪駅" },
    });
  });

  it("q だけならサーバー側で Geocoding する（失敗なら not_found）", async () => {
    const geocode = vi.fn(async () => ({ lat: 1, lng: 2 }));
    const result = await resolveDestination(adminWithSpot(null), { q: "大阪駅" }, geocode);
    expect(geocode).toHaveBeenCalledWith("大阪駅");
    expect(result.kind === "nearby" && result.destination).toEqual({ kind: "nearby", lat: 1, lng: 2, label: "大阪駅" });
    expect((await resolveDestination(adminWithSpot(null), { q: "xx" }, async () => null)).kind).toBe("not_found");
  });

  it("何も無ければ全件", async () => {
    expect((await resolveDestination(adminWithSpot(null), {})).kind).toBe("none");
  });
});

/**
 * #808（2026-10-06）: 行き先なしの /search は「みんなの投稿」
 * 出典: 要件定義書 3.4.2「みんなの投稿」・3.4.1、ワイヤーフレーム決定事項 83
 */
describe("みんなの投稿（#808）", () => {
  it("引数が何も無ければ、見出しは「みんなの投稿」で行き先は null（＝全件）", async () => {
    const resolved = await resolveDestination({} as never, {});
    expect(resolved.kind).toBe("none");
    if (resolved.kind === "spot_missing") throw new Error("spot_missing にはならない");
    expect(resolved.title).toBe("みんなの投稿");
    expect(resolved.destination).toBeNull();
  });

  it("「全国」「全て」のような範囲の言葉を見出しに出さない（海外に出しても変えなくて済むように）", async () => {
    const resolved = await resolveDestination({} as never, {});
    if (resolved.kind === "spot_missing") throw new Error("spot_missing にはならない");
    expect(resolved.title).not.toMatch(/全国|全て|すべて|近く/);
  });
});
