import { describe, expect, it } from "vitest";
import { ALLOWED_VIDEO_CODEC, checkVideo, isVideoFile, MAX_VIDEO_DURATION_SECONDS, parseVideoInfo } from "./process-video";

/**
 * 出典: Issue #861「動画の投稿を有効にする」単体テスト
 *       要件定義書 5.4（30 秒・50MB・中身が H.264 なら MP4／MOV のどちらでも）
 *
 * 【初心者向け】ここが見ているのは「**見る人全員が再生できる形か**」の判断だけです。
 * ffmpeg を実際に動かす部分はここでは試せない（実行ファイルが要る）ので、
 * **ffmpeg が出す説明文を読んで判断する純粋関数**を切り出してテストしています（約束 13）。
 */
describe("isVideoFile", () => {
  it("MP4 と MOV（quicktime）だけを動画として扱う", () => {
    expect(isVideoFile(new File([""], "a.mp4", { type: "video/mp4" }))).toBe(true);
    expect(isVideoFile(new File([""], "a.mov", { type: "video/quicktime" }))).toBe(true);
    expect(isVideoFile(new File([""], "a.MOV", { type: "" }))).toBe(true);
    expect(isVideoFile(new File([""], "a.avi", { type: "video/x-msvideo" }))).toBe(false);
    expect(isVideoFile(new File([""], "a.jpg", { type: "image/jpeg" }))).toBe(false);
  });
});

describe("parseVideoInfo（ffmpeg の説明文を読む）", () => {
  const h264 = `
  Duration: 00:00:12.34, start: 0.000000, bitrate: 1234 kb/s
    Stream #0:0(und): Video: h264 (High) (avc1 / 0x31637661), yuv420p, 1920x1080, 1200 kb/s
    Stream #0:1(und): Audio: aac (LC) (mp4a / 0x6134706D), 44100 Hz, stereo
`;
  const hevc = `
  Duration: 00:00:08.00, start: 0.000000, bitrate: 9000 kb/s
    Stream #0:0(und): Video: hevc (Main) (hvc1 / 0x31637668), yuv420p, 1920x1080
`;

  it("長さと映像のコーデックを読む", () => {
    expect(parseVideoInfo(h264)).toEqual({ durationSeconds: 12.34, videoCodec: "h264" });
  });

  it("HEVC も読み取れる（読み取れたうえで断る）", () => {
    expect(parseVideoInfo(hevc)).toEqual({ durationSeconds: 8, videoCodec: "hevc" });
  });

  it("時・分をまたいでも秒に直す", () => {
    expect(parseVideoInfo("Duration: 00:01:05.00\n Stream #0:0: Video: h264").durationSeconds).toBe(65);
    expect(parseVideoInfo("Duration: 01:00:00.00\n Stream #0:0: Video: h264").durationSeconds).toBe(3600);
  });

  it("読めないものは null（判断側で断る）", () => {
    expect(parseVideoInfo("これは動画ではありません")).toEqual({ durationSeconds: null, videoCodec: null });
  });
});

describe("checkVideo（受け付けてよいか）", () => {
  it("H.264 で 30 秒以内なら通す", () => {
    expect(checkVideo({ durationSeconds: 29.9, videoCodec: "h264" })).toEqual({ ok: true, durationSeconds: 29.9 });
    expect(checkVideo({ durationSeconds: MAX_VIDEO_DURATION_SECONDS, videoCodec: ALLOWED_VIDEO_CODEC })).toEqual({
      ok: true,
      durationSeconds: MAX_VIDEO_DURATION_SECONDS,
    });
  });

  it("30 秒を超えたら断る（ブラウザ側で切り取ってから上げる）", () => {
    expect(checkVideo({ durationSeconds: 30.01, videoCodec: "h264" })).toEqual({ ok: false, error: "video_too_long" });
  });

  it("HEVC は断る ── 上げた人の iPhone では再生できても、Android の Chrome では見られないため", () => {
    expect(checkVideo({ durationSeconds: 10, videoCodec: "hevc" })).toEqual({ ok: false, error: "unsupported_codec" });
  });

  it("H.264 以外はすべて断る", () => {
    for (const codec of ["vp9", "av1", "mpeg4", "prores"]) {
      expect(checkVideo({ durationSeconds: 10, videoCodec: codec }), codec).toEqual({ ok: false, error: "unsupported_codec" });
    }
  });

  it("中身を読めなかったものも断る（黙って通さない）", () => {
    expect(checkVideo({ durationSeconds: null, videoCodec: "h264" })).toEqual({ ok: false, error: "unsupported_format" });
    expect(checkVideo({ durationSeconds: 10, videoCodec: null })).toEqual({ ok: false, error: "unsupported_format" });
  });

  it("長さより先にコーデックを見る（HEVC で 1 分なら『形式が違う』と言う）", () => {
    // 直せる手が違うので、どちらを伝えるかが大事。形式は設定を変えてもらう、長さは切り取ってもらう
    expect(checkVideo({ durationSeconds: 60, videoCodec: "hevc" })).toEqual({ ok: false, error: "unsupported_codec" });
  });
});
