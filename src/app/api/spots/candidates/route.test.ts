import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 出典: docs/tasks/posts/spot-selection/02-spot-search-handler.md 単体テスト
 * - 登録済みスポットと Google Places の候補を統合し、投稿数が多い順に最大 5 件返す
 * - Places が落ちていても登録済みの候補は返し、placesUnavailable=true を付ける（要件 6.2）
 * - Bug #485: 応答は { candidates, placesUnavailable }（投稿画面のスポット欄が使う）
 */
const state = {
  user: { id: "me" } as { id: string } | null,
  stored: [
    { id: "s1", name: "浅草寺", lat: 35.7, lng: 139.8, source: "places", posts: [{ count: 3 }] },
    { id: "s2", name: "路地の店", lat: 35.7, lng: 139.8, source: "manual", posts: [{ count: 0 }] },
  ],
  placesError: false,
};

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: state.user }, error: null }) } }) }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({ select: () => ({ is: () => ({ ilike: () => ({ limit: async () => ({ data: state.stored, error: null }) }) }) }) }),
  }),
}));
vi.mock("@/lib/google/places", async () => {
  const actual = await vi.importActual<typeof import("@/lib/google/places")>("@/lib/google/places");
  return {
    ...actual,
    searchPlaces: async () => {
      if (state.placesError) throw new actual.PlacesApiError("down");
      return [
        { name: "浅草寺", lat: 35.7, lng: 139.8 },
        { name: "雷門", lat: 35.71, lng: 139.79 },
      ];
    },
  };
});

import { GET } from "./route";
const get = (query: string) => GET(new Request(`http://localhost/api/spots/candidates?query=${encodeURIComponent(query)}`));

beforeEach(() => {
  state.user = { id: "me" };
  state.placesError = false;
});

describe("GET /api/spots/candidates（投稿画面のスポット候補）", () => {
  it("登録済み＋Places を投稿数順に統合し、同名の Google 候補は重複させない", async () => {
    const body = (await (await get("浅草")).json()) as { candidates: { id: string | null; name: string; postCount: number }[]; placesUnavailable: boolean };
    expect(body.candidates.map((c) => c.name)).toEqual(["浅草寺", "路地の店", "雷門"]);
    expect(body.candidates[2]).toMatchObject({ id: null, postCount: 0 });
    expect(body.placesUnavailable).toBe(false);
  });

  it("Places が落ちていても登録済みの候補は返り、placesUnavailable=true", async () => {
    state.placesError = true;
    const body = (await (await get("浅草")).json()) as { candidates: { name: string }[]; placesUnavailable: boolean };
    expect(body.candidates.map((c) => c.name)).toEqual(["浅草寺", "路地の店"]);
    expect(body.placesUnavailable).toBe(true);
  });

  it("空の query は空の候補、未ログインは 401", async () => {
    expect(await (await get("  ")).json()).toEqual({ candidates: [], placesUnavailable: false });
    state.user = null;
    expect((await get("浅草")).status).toBe(401);
  });
});
