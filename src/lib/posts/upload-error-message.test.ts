import { describe, expect, it } from "vitest";
import { DEFAULT_UPLOAD_ERROR_MESSAGE, UPLOAD_ERROR_MESSAGES, uploadErrorMessage } from "./upload-error-message";

/**
 * #861（2026-10-09）: アップロードが断られた理由を、直し方が分かる文にする。
 *
 * 【初心者向け】ここで見張るのは「**次にどうすればよいかが書いてあるか**」です。
 * 「失敗しました」だけでは、利用者は同じことをもう一度して、また失敗します。
 */
describe("アップロードが断られた理由の文（#861）", () => {
  it("分からない合言葉でも、必ず何か返す（画面が空にならない）", () => {
    expect(uploadErrorMessage("なにかしらの新しいエラー")).toBe(DEFAULT_UPLOAD_ERROR_MESSAGE);
    expect(uploadErrorMessage(undefined)).toBe(DEFAULT_UPLOAD_ERROR_MESSAGE);
    expect(uploadErrorMessage(null)).toBe(DEFAULT_UPLOAD_ERROR_MESSAGE);
    expect(uploadErrorMessage({ error: "x" })).toBe(DEFAULT_UPLOAD_ERROR_MESSAGE);
  });

  it("HEVC のときは、カメラ設定の直し方を伝える", () => {
    const message = uploadErrorMessage("unsupported_codec");
    expect(message).toContain("互換性優先");
    expect(message).not.toBe(DEFAULT_UPLOAD_ERROR_MESSAGE);
  });

  it("長すぎるときは、短くする手を伝える", () => {
    expect(uploadErrorMessage("video_too_long")).toContain("30 秒");
    expect(uploadErrorMessage("video_too_long")).toContain("編集");
  });

  it("大きすぎるときは、写真と動画それぞれの上限を出す", () => {
    const message = uploadErrorMessage("file_too_large");
    expect(message).toContain("10MB");
    expect(message).toContain("50MB");
  });

  it("どの文にも「次にどうするか」が入っている（失敗を伝えるだけで終わらせない）", () => {
    for (const [key, message] of Object.entries(UPLOAD_ERROR_MESSAGES)) {
      expect(message.length, key).toBeGreaterThan(10);
      expect(message, `${key} に次の手が書かれていない`).toMatch(/ください|します|できます/);
    }
  });
});
