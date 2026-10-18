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

  /*
   * #904 の調査（2026-10-17）: ~~形式を問わずカメラ設定を案内する~~ →
   * **HEVC と分かったときだけ**案内する（下の describe で見ている）。
   * ここでは「形式が分からなくても、既定の文で終わらせない」ことだけを押さえる。
   */
  it("形式が分からなくても、直し方を伝える（既定の文で終わらせない）", () => {
    const message = uploadErrorMessage("unsupported_codec");
    expect(message).toContain("H.264");
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

/**
 * #904 の調査（2026-10-17）: 形式が分かるときは、その形式に合った直し方を出す。
 *
 * 【初心者向け】いままでは `unsupported_codec` のとき**どんな形式でも**
 * 「iPhone のカメラ設定を『互換性優先』に」と出していました。
 * **Android から VP9 を上げた人には的外れ**です（iPhone を持っていないかもしれません）。
 */
describe("形式に合わせた直し方（#904 の調査）", () => {
  it("HEVC のときだけ iPhone の設定を案内する", () => {
    for (const codec of ["hevc", "hvc1", "hev1", "h265", "HEVC"]) {
      const message = uploadErrorMessage("unsupported_codec", codec);
      expect(message, codec).toContain("HEVC");
      expect(message, codec).toContain("互換性優先");
    }
  });

  it("HEVC 以外は iPhone の設定を案内しない（形式の名前だけ添える）", () => {
    for (const codec of ["vp9", "av1", "mpeg4"]) {
      const message = uploadErrorMessage("unsupported_codec", codec);
      expect(message, codec).toContain(codec);
      expect(message, codec).not.toContain("iPhone");
      expect(message, codec).toContain("H.264");
    }
  });

  it("形式が分からないときは、iPhone と言わずに H.264 を案内する", () => {
    const message = uploadErrorMessage("unsupported_codec");
    expect(message).not.toContain("iPhone");
    expect(message).toContain("H.264");
  });

  it("ほかの理由では形式を使わない", () => {
    expect(uploadErrorMessage("video_too_long", "hevc")).toBe(UPLOAD_ERROR_MESSAGES.video_too_long);
  });
});

