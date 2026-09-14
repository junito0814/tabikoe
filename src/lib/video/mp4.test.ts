import { describe, expect, it } from "vitest";
import { hasVideoStream, isMp4Header, parseFfmpegDuration } from "./mp4";

/**
 * 出典: docs/tasks/posts/video-upload/02-video-processing-handler.md 単体テスト
 * - MP4 以外（拡張子だけ .mp4 にした別形式）を実体で弾くこと
 * - ffmpeg の出力から再生時間を正しく読むこと
 */
function ftypHeader(majorBrand: string, compatible: string[] = []): Uint8Array {
  const brands = [majorBrand, ...compatible];
  const size = 8 + 4 + 4 * brands.length; // size + "ftyp" + major + minor + compatibles
  const bytes = new Uint8Array(size + 16);
  bytes.set([0, 0, 0, size], 0);
  bytes.set(new TextEncoder().encode("ftyp"), 4);
  bytes.set(new TextEncoder().encode(majorBrand), 8);
  brands.slice(1).forEach((brand, index) => {
    bytes.set(new TextEncoder().encode(brand), 16 + index * 4);
  });
  return bytes;
}

describe("isMp4Header", () => {
  it("ftyp + MP4 系 brand を持つ先頭バイト列を MP4 と判定する", () => {
    expect(isMp4Header(ftypHeader("isom", ["iso2", "avc1", "mp41"]))).toBe(true);
    expect(isMp4Header(ftypHeader("mp42"))).toBe(true);
    expect(isMp4Header(ftypHeader("M4V "))).toBe(true);
  });

  it("互換 brand にだけ MP4 系がある場合も受理する（iPhone の MOV→MP4 変換等）", () => {
    expect(isMp4Header(ftypHeader("XXXX", ["isom"]))).toBe(true);
  });

  it("QuickTime（qt）や 3GP は MP4 として受理しない", () => {
    expect(isMp4Header(ftypHeader("qt  "))).toBe(false);
    expect(isMp4Header(ftypHeader("3gp4"))).toBe(false);
  });

  it("ftyp ボックスが無いもの（JPEG・テキスト・短すぎる）は拒否する", () => {
    expect(isMp4Header(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe(false);
    expect(isMp4Header(new TextEncoder().encode("hello world, not a video"))).toBe(false);
    expect(isMp4Header(new Uint8Array(4))).toBe(false);
  });
});

describe("parseFfmpegDuration", () => {
  it("Duration: HH:MM:SS.ss を秒に変換する", () => {
    expect(parseFfmpegDuration("  Duration: 00:00:12.34, start: 0.000000, bitrate: 1 kb/s")).toBeCloseTo(12.34);
    expect(parseFfmpegDuration("Duration: 00:01:00.00")).toBe(60);
    expect(parseFfmpegDuration("Duration: 01:02:03.5")).toBe(3723.5);
  });

  it("Duration が無ければ null", () => {
    expect(parseFfmpegDuration("Invalid data found when processing input")).toBeNull();
    expect(parseFfmpegDuration("Duration: N/A")).toBeNull();
  });
});

describe("hasVideoStream", () => {
  it("映像ストリームの行があれば true、音声のみなら false", () => {
    expect(
      hasVideoStream("  Stream #0:0[0x1](und): Video: h264 (High) (avc1 / 0x31637661), yuv420p, 1920x1080")
    ).toBe(true);
    expect(hasVideoStream("  Stream #0:0[0x1](und): Audio: aac (LC) (mp4a / 0x6134706D), 44100 Hz")).toBe(false);
  });
});
