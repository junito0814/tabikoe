import { beforeEach, describe, expect, it, vi } from "vitest";
import { claimsResultOf } from "@/lib/auth/claims-result";

/**
 * 出典: Issue #951、要件定義書 3.5.4「API は GET だけを未ログインに開ける」
 *
 * 【初心者向け】いままでは**入口で「ログインしているか」を見て止めていた**ので、
 * その手前にある「この投稿は見てよいものか」の判定が効いているかを確かめたことがありませんでした。
 * 未ログインに開けるにあたって、受入条件のとおり**非公開投稿のコメントが取れないこと**を押さえます。
 */
const state = {
  user: null as { id: string } | null,
  post: { id: "p1", user_id: "author", visibility: "public" } as { id: string; user_id: string; visibility: string } | null,
};

const listComments = vi.fn(async () => ({ comments: [], nextOffset: null, totalCount: 0, viewerAvatarUrl: null }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getClaims: async () => claimsResultOf(state.user) } }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/likes/like-post", async () => {
  const actual = await vi.importActual<typeof import("@/lib/likes/like-post")>("@/lib/likes/like-post");
  return { ...actual, findLikeTarget: async () => actual.evaluateLikeTarget(state.post, false) };
});
vi.mock("@/lib/comments/list-comments", () => ({ listComments: (...args: unknown[]) => listComments(...(args as [])) }));

import { GET } from "./route";

const get = () => GET(new Request("http://localhost/api/posts/p1/comments"), { params: Promise.resolve({ id: "p1" }) });

beforeEach(() => {
  state.user = null;
  state.post = { id: "p1", user_id: "author", visibility: "public" };
  listComments.mockClear();
});

describe("GET /api/posts/[id]/comments（#951 未ログインに開ける）", () => {
  it("未ログインでも公開投稿のコメントは読める（200）", async () => {
    const response = await get();
    expect(response.status).toBe(200);
    // 閲覧者が誰でもないことが、そのまま下まで伝わる（自分のコメントが 1 つも無い扱いになる）
    expect(listComments).toHaveBeenCalledWith(expect.anything(), null, "p1", 0);
  });

  it("未ログインでも、非公開投稿のコメントは取れない（403）", async () => {
    state.post = { id: "p1", user_id: "author", visibility: "private" };
    const response = await get();
    expect(response.status).toBe(403);
    expect(listComments).not.toHaveBeenCalled();
  });

  it("ログイン済みでも、非公開投稿のコメントは取れない（以前は空の一覧を返していた）", async () => {
    state.user = { id: "me" };
    state.post = { id: "p1", user_id: "author", visibility: "private" };
    expect((await get()).status).toBe(403);
    expect(listComments).not.toHaveBeenCalled();
  });

  it("存在しない投稿は 404（存在そのものを伏せる）", async () => {
    state.post = null;
    expect((await get()).status).toBe(404);
    expect(listComments).not.toHaveBeenCalled();
  });

  it("ログイン済みは今までどおり、自分として読む", async () => {
    state.user = { id: "me" };
    expect((await get()).status).toBe(200);
    expect(listComments).toHaveBeenCalledWith(expect.anything(), "me", "p1", 0);
  });
});
