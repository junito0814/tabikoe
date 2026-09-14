import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 出典: docs/tasks/records/album-photos/01-album-photos-handler.md 単体テスト
 * - 未ログインで401、メンバー以外で404、メンバーで1ページ返す
 */
const { state, getAlbumMediaPage } = vi.hoisted(() => {
  const state = {
    user: { id: "me" } as { id: string } | null,
    page: null as unknown,
    error: null as Error | null,
  };
  const getAlbumMediaPage = vi.fn(async () => {
    if (state.error) throw state.error;
    return state.page;
  });
  return { state, getAlbumMediaPage };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user }, error: null }) },
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/albums/album-photos", () => ({ getAlbumMediaPage }));

import { GET } from "./route";

function get(offset?: string) {
  const url = `http://localhost/api/trips/trip-1/photos${offset ? `?offset=${offset}` : ""}`;
  return GET(new Request(url), { params: Promise.resolve({ id: "trip-1" }) });
}

beforeEach(() => {
  state.user = { id: "me" };
  state.page = { items: [], nextOffset: null };
  state.error = null;
  getAlbumMediaPage.mockClear();
});

describe("GET /api/trips/[id]/photos", () => {
  it("メンバーには1ページ返し、offset を渡す", async () => {
    const response = await get("40");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: [], nextOffset: null });
    expect(getAlbumMediaPage).toHaveBeenCalledWith({}, "me", "trip-1", 40);
  });

  it("未ログインは401", async () => {
    state.user = null;
    expect((await get()).status).toBe(401);
    expect(getAlbumMediaPage).not.toHaveBeenCalled();
  });

  it("メンバー以外（null）は404", async () => {
    state.page = null;
    expect((await get()).status).toBe(404);
  });

  it("不正な offset は0扱い", async () => {
    await get("abc");
    expect(getAlbumMediaPage).toHaveBeenCalledWith({}, "me", "trip-1", 0);
  });

  it("取得失敗は500", async () => {
    state.error = new Error("down");
    expect((await get()).status).toBe(500);
  });
});
