import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 出典: docs/tasks/posts/video-upload/02-video-processing-handler.md 単体テスト
 * - 本人のディレクトリ配下以外のパスを処理しないこと
 * - 検証エラー（形式・サイズ・長さ）を 400 で返し、処理失敗は 500 にすること
 */
// vi.mock はファイル先頭へ巻き上げられるため、factory から参照する値は vi.hoisted で先に作る
const { state, processAndStoreVideo } = vi.hoisted(() => {
  const state = {
    user: { id: "me" } as { id: string } | null,
    processResult: null as unknown,
    processError: null as Error | null,
  };
  const processAndStoreVideo = vi.fn(async () => {
    if (state.processError) throw state.processError;
    return state.processResult;
  });
  return { state, processAndStoreVideo };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user }, error: null }) },
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/video/process-video", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/video/process-video")>();
  return { ...original, processAndStoreVideo };
});

import { POST } from "./route";
import { VideoValidationError } from "@/lib/video/process-video";

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/posts/videos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

beforeEach(() => {
  state.user = { id: "me" };
  state.processResult = { thumbnailPath: "me/x/thumbnail.jpg", videoPath: "me/x/video.mp4", durationSeconds: 5 };
  state.processError = null;
  processAndStoreVideo.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/posts/videos", () => {
  it("処理結果を投稿 API の media 形式で返す", async () => {
    const response = await post({ path: "me/x/video.mp4" });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      video: { mediaType: "video", storagePath: "me/x/thumbnail.jpg", videoPath: "me/x/video.mp4", durationSeconds: 5 },
    });
  });

  it("未ログインは401", async () => {
    state.user = null;
    expect((await post({ path: "me/x/video.mp4" })).status).toBe(401);
  });

  it("他人のディレクトリ・想定外のファイル名・.. を含むパスは 400 invalid_path", async () => {
    for (const path of ["other/x/video.mp4", "me/x/evil.sh", "me/../other/video.mp4", 123]) {
      const response = await post({ path });
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "invalid_path" });
    }
    expect(processAndStoreVideo).not.toHaveBeenCalled();
  });

  it("検証エラーはそのコードで 400", async () => {
    state.processError = new VideoValidationError("video_too_long");
    const response = await post({ path: "me/x/video.mp4" });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "video_too_long" });
  });

  it("アップロードされていないパスは 404", async () => {
    state.processError = new VideoValidationError("video_not_found");
    expect((await post({ path: "me/x/video.mp4" })).status).toBe(404);
  });

  it("ffmpeg 等の内部エラーは 500 processing_failed", async () => {
    state.processError = new Error("spawn failed");
    const response = await post({ path: "me/x/video.mp4" });
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "processing_failed" });
  });
});
