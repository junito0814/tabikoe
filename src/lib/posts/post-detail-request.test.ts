import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 出典: Issue #964（「見つかりません」の画面が HTTP 200 を返す）
 *
 * 【初心者向け】ここで押さえたいのは**ひとつだけ**です ──
 * 「**無い**」と「**読めなかった**」を混ぜないこと。
 *
 * 流し始める前に 404 を決めるため、`generateMetadata` から
 * 「この投稿は在るか」を聞くようにしました。もしこの 2 つを混ぜると、
 * **DB が一時的に落ちただけで投稿が消えたように見えます**（404 を返してしまう）。
 * ステータスは一度返すと取り消せないので、ここは取り違えてはいけません。
 */
const getPostDetail = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({})) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({})) }));
vi.mock("@/lib/auth/auth-user", () => ({ getAuthUserFromClaims: vi.fn(async () => ({ id: "me" })) }));
vi.mock("@/lib/posts/post-detail", () => ({ getPostDetail: (...args: unknown[]) => getPostDetail(...args) }));

import { loadPostDetailOnce } from "./post-detail-request";

describe("loadPostDetailOnce（#964）", () => {
  beforeEach(() => {
    getPostDetail.mockReset();
  });

  it("見られない投稿は post: null・failed: false（＝ 404 にしてよい）", async () => {
    getPostDetail.mockResolvedValue(null);
    await expect(loadPostDetailOnce("missing")).resolves.toEqual({ post: null, failed: false });
  });

  it("読み込みが失敗したときは failed: true（＝ 404 にしてはいけない）", async () => {
    getPostDetail.mockRejectedValue(new Error("db down"));
    await expect(loadPostDetailOnce("broken")).resolves.toEqual({ post: null, failed: true });
  });

  it("見られる投稿はそのまま返す", async () => {
    const post = { id: "p1" };
    getPostDetail.mockResolvedValue(post);
    await expect(loadPostDetailOnce("p1")).resolves.toEqual({ post, failed: false });
  });

  /**
   * 見ている人の id を渡していること。
   * 非公開投稿は本人とアルバムの仲間だけが見られるので、ここを渡し忘れると
   * **本人が自分の非公開投稿を開いたときに 404 になります**。
   */
  it("見ている人の id を渡す", async () => {
    getPostDetail.mockResolvedValue(null);
    await loadPostDetailOnce("p2");
    expect(getPostDetail).toHaveBeenCalledWith(expect.anything(), "me", "p2");
  });
});
