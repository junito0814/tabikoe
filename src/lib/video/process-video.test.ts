/**
 * 出典: docs/tasks/posts/post-creation-v3/04-video-mov-support.md（単体テスト）
 * 「MIME と拡張子の組み合わせ検証（MOV/MP4 のみ通す、1 分超は拒否）」
 */
import { describe, expect, it } from "vitest";
import { isVideoFile, parseDurationSeconds, MAX_VIDEO_DURATION_SECONDS } from "./process-video";

describe("isVideoFile", () => {
  it("MP4 と MOV（quicktime）だけを動画として扱う", () => {
    expect(isVideoFile(new File([""], "a.mp4", { type: "video/mp4" }))).toBe(true);
    expect(isVideoFile(new File([""], "a.mov", { type: "video/quicktime" }))).toBe(true);
    expect(isVideoFile(new File([""], "a.MOV", { type: "" }))).toBe(true);
    expect(isVideoFile(new File([""], "a.avi", { type: "video/x-msvideo" }))).toBe(false);
    expect(isVideoFile(new File([""], "a.jpg", { type: "image/jpeg" }))).toBe(false);
  });
});

describe("parseDurationSeconds", () => {
  it("ffmpeg の出力から秒数を読む", () => {
    expect(parseDurationSeconds("  Duration: 00:00:12.34, start: 0.000000")).toBeCloseTo(12.34);
    expect(parseDurationSeconds("  Duration: 00:01:05.00, bitrate")).toBe(65);
    expect(parseDurationSeconds("no duration")).toBeNull();
  });
  it("1 分超の判定に使える", () => {
    expect(parseDurationSeconds("Duration: 00:01:00.50")! > MAX_VIDEO_DURATION_SECONDS).toBe(true);
    expect(parseDurationSeconds("Duration: 00:00:59.99")! > MAX_VIDEO_DURATION_SECONDS).toBe(false);
  });
});
