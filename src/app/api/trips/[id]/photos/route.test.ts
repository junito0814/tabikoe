import { beforeEach, describe, expect, it, vi } from "vitest";
import { claimsResultOf } from "@/lib/auth/claims-result";

/**
 * 出典: docs/tasks/records/album-photos/01-album-photos-api.md 単体テスト
 * - メンバーでないユーザーには 404（存在を伏せる）
 * - メンバーには非公開投稿の写真も含めて新着順に返る（運営が非公開化した写真は除く）
 * - offset で 2 ページ目が取れる
 */
const state = { user: { id: "me" } as { id: string } | null, myRole: "viewer" as string | null, tripHiddenAt: null as string | null };

const photo = (id: string, order: number, hiddenAt: string | null = null) => ({ id, storage_url: `p/${id}.jpg`, video_url: null, media_type: "photo", display_order: order, hidden_at: hiddenAt });
const posts = [
  { id: "new", created_at: "2026-09-02T00:00:00Z", visibility: "private", rating: 4, duration: "1h", cost: null, visit_date: null, spots: { name: "A", source: "manual" }, users: { display_name: "o", is_deleted: false }, post_photos: [photo("n2", 2), photo("n1", 1), photo("hidden", 3, "2026-09-03T00:00:00Z")] },
  { id: "old", created_at: "2026-09-01T00:00:00Z", visibility: "public", rating: null, duration: null, cost: 1000, visit_date: "2026-08-30", spots: { name: "B" }, users: { display_name: "o", is_deleted: false }, post_photos: [photo("o1", 1)] },
];

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getClaims: async () => claimsResultOf(state.user) } }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const q: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in", "order", "is", "limit"]) q[m] = () => q;
      q.maybeSingle = async () => ({
        data: table === "trips" ? { id: "trip-1", user_id: "owner", hidden_at: state.tripHiddenAt } : table === "album_members" ? state.myRole && { role: state.myRole } : null,
        error: null,
      });
      q.then = (resolve: (v: unknown) => void) => resolve({ data: table === "posts" ? posts : [], error: null });
      return q;
    },
    storage: {
      from: () => ({
        createSignedUrls: async (paths: string[]) => ({ data: paths.map((path) => ({ path, signedUrl: `https://signed/${path}` })), error: null }),
      }),
    },
  }),
}));

import { GET } from "./route";
const get = (query = "") => GET(new Request(`http://localhost/api/trips/trip-1/photos${query}`), { params: Promise.resolve({ id: "trip-1" }) });

beforeEach(() => {
  state.user = { id: "me" };
  state.myRole = "viewer";
  state.tripHiddenAt = null;
});

describe("GET /api/trips/[id]/photos（SC-21）", () => {
  it("メンバーには非公開投稿も含めて新着順・添付順で返る（非公開化された写真は除く）", async () => {
    const response = await get();
    expect(response.status).toBe(200);
    const body = (await response.json()) as { items: { id: string; postId: string; thumbnailUrl: string; info: { spotName: string; isManualSpot: boolean } }[]; nextOffset: number | null };
    expect(body.items.map((item) => item.id)).toEqual(["n1", "n2", "o1"]);
    expect(body.items[0]).toMatchObject({ postId: "new", thumbnailUrl: "https://signed/p/n1.jpg", info: { spotName: "A", isManualSpot: true } });
    expect(body.nextOffset).toBeNull();
  });

  it("offset で途中から取れる", async () => {
    const body = (await (await get("?offset=2")).json()) as { items: { id: string }[] };
    expect(body.items.map((item) => item.id)).toEqual(["o1"]);
  });

  it("メンバーでなければ 404（存在を伏せる）", async () => {
    state.myRole = null;
    expect((await get()).status).toBe(404);
  });

  it("非公開化されたアルバムはオーナー以外 404", async () => {
    state.tripHiddenAt = "2026-09-10T00:00:00Z";
    expect((await get()).status).toBe(404);
  });

  it("未ログインは 401", async () => {
    state.user = null;
    expect((await get()).status).toBe(401);
  });
});
