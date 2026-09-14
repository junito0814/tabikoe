import { describe, expect, it } from "vitest";
import { parseMediaInput, toPostPhotoRows } from "./media-input";

/**
 * 出典: docs/tasks/posts/video-upload/03-post-media-integration.md 単体テスト
 * - 写真と動画が混在した media を post_photos の行に変換できること
 * - 他人のディレクトリ配下のパスを紐づけられないこと
 */
const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

describe("parseMediaInput", () => {
  it("旧形式 photoPaths（写真のみ）を受け付ける", () => {
    const result = parseMediaInput({ photoPaths: [`${ME}/a/resized.jpg`] }, ME);
    expect(result).toEqual({
      ok: true,
      items: [{ mediaType: "photo", storagePath: `${ME}/a/resized.jpg`, videoPath: null, durationSeconds: null }],
    });
  });

  it("media に写真と動画を混在させ、順序を保って受け付ける", () => {
    const result = parseMediaInput(
      {
        media: [
          { mediaType: "video", storagePath: `${ME}/v/thumbnail.jpg`, videoPath: `${ME}/v/video.mp4`, durationSeconds: 12 },
          { mediaType: "photo", storagePath: `${ME}/p/resized.jpg` },
        ],
      },
      ME
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.items.map((item) => item.mediaType)).toEqual(["video", "photo"]);
    expect(result.items[0]).toMatchObject({ videoPath: `${ME}/v/video.mp4`, durationSeconds: 12 });
  });

  it("1点も無ければ media_required", () => {
    expect(parseMediaInput({}, ME)).toEqual({ ok: false, error: "media_required" });
    expect(parseMediaInput({ media: [], photoPaths: [] }, ME)).toEqual({ ok: false, error: "media_required" });
  });

  it("動画に videoPath や整数の durationSeconds が無ければ invalid_media", () => {
    expect(
      parseMediaInput({ media: [{ mediaType: "video", storagePath: `${ME}/v/t.jpg` }] }, ME)
    ).toEqual({ ok: false, error: "invalid_media" });
    expect(
      parseMediaInput(
        { media: [{ mediaType: "video", storagePath: `${ME}/v/t.jpg`, videoPath: `${ME}/v/video.mp4`, durationSeconds: 1.5 }] },
        ME
      )
    ).toEqual({ ok: false, error: "invalid_media" });
    expect(parseMediaInput({ media: [{ mediaType: "gif", storagePath: `${ME}/x` }] }, ME)).toEqual({
      ok: false,
      error: "invalid_media",
    });
  });

  it("他人のディレクトリ配下や .. を含むパスは media_path_not_owned", () => {
    expect(parseMediaInput({ photoPaths: [`${OTHER}/a/resized.jpg`] }, ME)).toEqual({
      ok: false,
      error: "media_path_not_owned",
    });
    expect(
      parseMediaInput(
        { media: [{ mediaType: "video", storagePath: `${ME}/v/t.jpg`, videoPath: `${OTHER}/v/video.mp4`, durationSeconds: 3 }] },
        ME
      )
    ).toEqual({ ok: false, error: "media_path_not_owned" });
    expect(parseMediaInput({ photoPaths: [`${ME}/../${OTHER}/a.jpg`] }, ME)).toEqual({
      ok: false,
      error: "media_path_not_owned",
    });
  });
});

describe("toPostPhotoRows", () => {
  it("display_order を開始値から連番で振り、動画は video_url・duration_seconds を持つ", () => {
    const rows = toPostPhotoRows(
      "post-1",
      [
        { mediaType: "photo", storagePath: "p1", videoPath: null, durationSeconds: null },
        { mediaType: "video", storagePath: "t1", videoPath: "v1", durationSeconds: 7 },
      ],
      3
    );
    expect(rows).toEqual([
      { post_id: "post-1", media_type: "photo", storage_url: "p1", video_url: null, duration_seconds: null, display_order: 3 },
      { post_id: "post-1", media_type: "video", storage_url: "t1", video_url: "v1", duration_seconds: 7, display_order: 4 },
    ]);
  });
});
