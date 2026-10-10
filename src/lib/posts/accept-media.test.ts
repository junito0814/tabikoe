import { describe, expect, it } from "vitest";
import { decideMedia, formatSeconds, MAX_PHOTO_SIZE_BYTES } from "./accept-media";
import { MAX_VIDEO_DURATION_SECONDS, MAX_VIDEO_SIZE_BYTES } from "@/lib/video/limits";

/**
 * #861（2026-10-09）: 選んだファイルを受け付けてよいかの判断。
 *
 * 【初心者向け】ここで見張るのは**断り方**です。
 * 「できません」とだけ言うと、利用者は同じことをもう一度して、また断られます。
 * 何が引っかかったのか（長さなのか、大きさなのか）で、次にすべきことが変わります。
 */
const photo = { isVideo: false, type: "image/jpeg", sizeBytes: 1000, durationSeconds: null, videoDisabled: false, canTrim: true };
const video = { isVideo: true, type: "video/mp4", sizeBytes: 1000, durationSeconds: 10, videoDisabled: false, canTrim: true };

describe("formatSeconds", () => {
  it("分と秒に直す", () => {
    expect(formatSeconds(0)).toBe("0:00");
    expect(formatSeconds(42)).toBe("0:42");
    expect(formatSeconds(72.9)).toBe("1:12");
    expect(formatSeconds(600)).toBe("10:00");
  });
});

describe("写真", () => {
  it("JPEG と PNG は通す", () => {
    expect(decideMedia(photo)).toEqual({ kind: "accept" });
    expect(decideMedia({ ...photo, type: "image/png" })).toEqual({ kind: "accept" });
  });

  it("それ以外の形式は断る", () => {
    expect(decideMedia({ ...photo, type: "image/webp" })).toEqual({ kind: "reject", message: "写真は JPEG か PNG だけ投稿できます" });
  });

  it("10MB を超えたら断る", () => {
    expect(decideMedia({ ...photo, sizeBytes: MAX_PHOTO_SIZE_BYTES + 1 }).kind).toBe("reject");
    expect(decideMedia({ ...photo, sizeBytes: MAX_PHOTO_SIZE_BYTES })).toEqual({ kind: "accept" });
  });
});

describe("動画", () => {
  it("30 秒以内なら通す", () => {
    expect(decideMedia(video)).toEqual({ kind: "accept" });
    expect(decideMedia({ ...video, durationSeconds: MAX_VIDEO_DURATION_SECONDS })).toEqual({ kind: "accept" });
  });

  it("30 秒を超えたら、切り取りへ送る（断らない）", () => {
    expect(decideMedia({ ...video, durationSeconds: 72 })).toEqual({ kind: "needs_trim", durationSeconds: 72 });
  });

  it("切り取れない端末では、長さを添えて断り、直し方を伝える", () => {
    const result = decideMedia({ ...video, durationSeconds: 72, canTrim: false });
    expect(result.kind).toBe("reject");
    // 何秒なのかを出さないと、どれだけ短くすればよいか分からない
    expect(result.kind === "reject" && result.message).toContain("1:12");
    expect(result.kind === "reject" && result.message).toContain("写真アプリ");
  });

  it("長さを読めなかったときは、長さでは断らない（サーバーが中身を見て決める）", () => {
    expect(decideMedia({ ...video, durationSeconds: null })).toEqual({ kind: "accept" });
  });

  it("50MB を超えたら断る", () => {
    expect(decideMedia({ ...video, sizeBytes: MAX_VIDEO_SIZE_BYTES + 1 }).kind).toBe("reject");
  });

  it("長さを先に見る ── 長くて大きい動画は「短くすれば入る」ので、切り取りへ送る", () => {
    // 大きさで先に断ると「別の動画を選べ」と言ってしまい、切り取れば済むことが伝わらない
    expect(decideMedia({ ...video, durationSeconds: 90, sizeBytes: MAX_VIDEO_SIZE_BYTES + 1 })).toEqual({ kind: "needs_trim", durationSeconds: 90 });
  });

  it("受付を止めている間は、動画だけ断る（写真は通す）", () => {
    expect(decideMedia({ ...video, videoDisabled: true })).toEqual({ kind: "reject", message: "動画は近日対応します。いまは写真だけ投稿できます" });
    expect(decideMedia({ ...photo, videoDisabled: true })).toEqual({ kind: "accept" });
  });

  it("形式（コーデック）では断らない ── 上げる人の端末では HEVC も再生できるため", () => {
    // `.mp4` の中に HEVC が入っていることがある。中身の判断はサーバーの仕事（要件 5.4）
    expect(decideMedia({ ...video, type: "video/quicktime" })).toEqual({ kind: "accept" });
  });
});
