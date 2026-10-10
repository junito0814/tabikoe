/**
 * #923（2026-10-10）: 選んだものを Storage へ送るところ。
 *
 * 【初心者向け】ここは **1 枚ずつ順番に**送っていました（`for` の中で `await`）。
 * 3 枚あれば 3 回ぶん待つことになります。置き場所はそれぞれ別なのでぶつかりません。
 * 実機から「時間がかかりすぎ」と報告があり、まとめて送る形にしました。
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const uploadToSignedUrl = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ storage: { from: () => ({ uploadToSignedUrl }) } }),
}));

const slots = [
  { path: "u/tmp/1", token: "t1" },
  { path: "u/tmp/2", token: "t2" },
  { path: "u/tmp/3", token: "t3" },
];
const fetchWithAuthRedirect = vi.fn(async (url: string) =>
  url.includes("upload-url")
    ? new Response(JSON.stringify({ bucket: "post-media", slots }), { status: 200 })
    : new Response(JSON.stringify({ media: [] }), { status: 201 })
);
vi.mock("@/lib/api/fetch-with-auth-redirect", () => ({ fetchWithAuthRedirect: (...args: unknown[]) => fetchWithAuthRedirect(...(args as [string])) }));

import { uploadPostMedia } from "./upload-media";

const files = () => [new File(["a"], "a.jpg"), new File(["b"], "b.jpg"), new File(["c"], "c.jpg")];

beforeEach(() => {
  uploadToSignedUrl.mockReset();
  fetchWithAuthRedirect.mockClear();
});

describe("まとめて送る", () => {
  it("1 つ目が終わるのを待たずに 2 つ目を始める", async () => {
    const order: string[] = [];
    uploadToSignedUrl.mockImplementation(async (path: string) => {
      order.push(`始:${path}`);
      await new Promise((resolve) => setTimeout(resolve, 15));
      order.push(`終:${path}`);
      return { error: null };
    });

    await uploadPostMedia(files());

    // 3 つとも「始」が並んでから「終」が来る＝順番待ちをしていない
    expect(order.slice(0, 3)).toEqual(["始:u/tmp/1", "始:u/tmp/2", "始:u/tmp/3"]);
  });

  it("進み具合を伝える（止まって見えないように）", async () => {
    uploadToSignedUrl.mockResolvedValue({ error: null });
    const seen: string[] = [];

    await uploadPostMedia(files(), { onProgress: (done, total) => seen.push(`${done}/${total}`) });

    expect(seen[0]).toBe("0/3");
    expect(seen.at(-1)).toBe("3/3");
  });

  it("1 つでも失敗したら、まとめて断る", async () => {
    uploadToSignedUrl
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: "too large" } })
      .mockResolvedValueOnce({ error: null });

    const response = await uploadPostMedia(files());

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "upload_failed" });
    // 失敗したら「上げました」を送らない（サーバーに半端な組を渡さない）
    expect(fetchWithAuthRedirect.mock.calls.filter(([url]) => url.includes("/api/posts/photos"))).toHaveLength(0);
  });

  it("置き場所をもらえなかったら、その応答をそのまま返す", async () => {
    fetchWithAuthRedirect.mockResolvedValueOnce(new Response("{}", { status: 429 }));
    const response = await uploadPostMedia(files());
    expect(response.status).toBe(429);
    expect(uploadToSignedUrl).not.toHaveBeenCalled();
  });
});
