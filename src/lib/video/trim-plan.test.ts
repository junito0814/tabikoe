import { describe, expect, it } from "vitest";
import {
  checkTrimFeasible,
  checkTrimmedOutput,
  estimateTrimmedBytes,
  formatMegabytes,
  MAX_TRIM_SOURCE_BYTES,
  maxStartSeconds,
  planTrim,
  snapToKeyframe,
  TRIM_FALLBACK_MESSAGE,
  TRIM_WINDOW_SECONDS,
  trimFailureMessage,
} from "./trim-plan";
import { MAX_VIDEO_SIZE_BYTES } from "./limits";

/**
 * #861 / 要件 4.5.17（2026-10-10）: どこを切り取るか・結果を通すかの判断。
 *
 * 【初心者向け】ここで見張るのは**切りすぎ／切り足らず**です。
 *   30 秒を 1 コマでも超えるとサーバーに断られ（`video_too_long`）、
 *   短すぎると「切り取れたつもりで壊れている」ことになります。
 */

/** 2 秒ごとのキーフレーム（よくある間隔） */
const everyTwoSeconds = Array.from({ length: 30 }, (_, i) => i * 2);

describe("snapToKeyframe", () => {
  it("いちばん近いキーフレームへ寄せる", () => {
    expect(snapToKeyframe(everyTwoSeconds, 11.1)).toBe(12);
    expect(snapToKeyframe(everyTwoSeconds, 10.9)).toBe(10);
  });

  it("ちょうど真ん中なら後ろを採る（選んだ位置より前の映像を入れない）", () => {
    expect(snapToKeyframe(everyTwoSeconds, 11)).toBe(12);
  });

  it("キーフレームが分からないときは、そのまま返す", () => {
    expect(snapToKeyframe([], 11)).toBe(11);
  });
});

describe("maxStartSeconds", () => {
  it("後ろから 30 秒ぶんは残す", () => {
    expect(maxStartSeconds(72)).toBe(42);
  });

  it("30 秒以下の動画では動かせない", () => {
    expect(maxStartSeconds(20)).toBe(0);
  });
});

describe("planTrim", () => {
  it("開始位置をキーフレームへ寄せ、30 秒ぶんを取る", () => {
    expect(planTrim({ keyframeTimes: everyTwoSeconds, durationSeconds: 72, wantStartSeconds: 11.1 })).toEqual({ startSeconds: 12, endSeconds: 42 });
  });

  it("右端より後ろは選べない", () => {
    expect(planTrim({ keyframeTimes: everyTwoSeconds, durationSeconds: 72, wantStartSeconds: 90 })).toEqual({ startSeconds: 42, endSeconds: 72 });
  });

  it("左端より前も選べない", () => {
    expect(planTrim({ keyframeTimes: everyTwoSeconds, durationSeconds: 72, wantStartSeconds: -5 })).toEqual({ startSeconds: 0, endSeconds: 30 });
  });

  it("右端を越えたキーフレームへは寄せない ── 寄せると 30 秒に足りなくなる", () => {
    // 右端は 42。44 の方が近いが、そこから取ると 28 秒しか残らない
    const plan = planTrim({ keyframeTimes: [40, 44], durationSeconds: 72, wantStartSeconds: 43 });
    expect(plan).toEqual({ startSeconds: 40, endSeconds: 70 });
    expect(plan.endSeconds - plan.startSeconds).toBe(TRIM_WINDOW_SECONDS);
  });

  it("寄せた先が右端ぴったりでも 30 秒とれる", () => {
    const plan = planTrim({ keyframeTimes: [0, 42], durationSeconds: 72, wantStartSeconds: 41 });
    expect(plan).toEqual({ startSeconds: 42, endSeconds: 72 });
  });
});

describe("checkTrimFeasible", () => {
  it("ふつうの動画は通す", () => {
    // 72 秒・30MB → 30 秒ぶんは 12.5MB
    expect(checkTrimFeasible({ sourceBytes: 30 * 1024 * 1024, durationSeconds: 72 })).toEqual({ ok: true });
  });

  it("切り取っても 50MB を大きく超える見込みなら、始める前に断る", () => {
    // 60 秒・300MB → 30 秒ぶんは 150MB。切っても入らない
    const result = checkTrimFeasible({ sourceBytes: 300 * 1024 * 1024, durationSeconds: 60 });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toBe("estimated_too_large");
  });

  it("50MB をわずかに超える見込みでは断らない ── 見込みは当てにならないので、切ってから測る", () => {
    // 60 秒・110MB → 見込み 55MB（50MB の 1.3 倍以内）
    expect(checkTrimFeasible({ sourceBytes: 110 * 1024 * 1024, durationSeconds: 60 })).toEqual({ ok: true });
  });

  it("読み込むだけでブラウザが落ちる大きさは断る", () => {
    // 1 時間・400MB → 30 秒ぶんは 3MB で入るが、読み込みが重すぎる
    const result = checkTrimFeasible({ sourceBytes: MAX_TRIM_SOURCE_BYTES + 1, durationSeconds: 3600 });
    expect(result.ok === false && result.reason).toBe("source_too_large");
  });
});

describe("estimateTrimmedBytes", () => {
  it("長さの割合で見込む", () => {
    expect(estimateTrimmedBytes(1000, 60)).toBe(500);
  });

  it("30 秒以下の動画では、元のまま", () => {
    expect(estimateTrimmedBytes(1000, 20)).toBe(1000);
  });
});

describe("checkTrimmedOutput（安全網）", () => {
  const expectedSeconds = 30;

  it("30 秒以内で、思った長さに近ければ通す", () => {
    expect(checkTrimmedOutput({ durationSeconds: 29.97, sizeBytes: 1000, expectedSeconds })).toEqual({ ok: true, durationSeconds: 29.97 });
  });

  it("長さを読めなかったら通さない ── 壊れたものを上げるより案内に戻す", () => {
    expect(checkTrimmedOutput({ durationSeconds: null, sizeBytes: 1000, expectedSeconds })).toEqual({ ok: false, reason: "unreadable" });
  });

  it("30 秒を 0.1 秒でも超えたら通さない ── サーバーが断るので、ここで気づく", () => {
    expect(checkTrimmedOutput({ durationSeconds: 30.07, sizeBytes: 1000, expectedSeconds })).toEqual({ ok: false, reason: "too_long" });
  });

  it("思ったより短すぎたら通さない", () => {
    expect(checkTrimmedOutput({ durationSeconds: 3, sizeBytes: 1000, expectedSeconds })).toEqual({ ok: false, reason: "too_short" });
  });

  it("コマ 1 枚ぶん短いのは通す", () => {
    expect(checkTrimmedOutput({ durationSeconds: 29.9, sizeBytes: 1000, expectedSeconds }).ok).toBe(true);
  });

  it("50MB を超えたら通さない", () => {
    expect(checkTrimmedOutput({ durationSeconds: 29.9, sizeBytes: MAX_VIDEO_SIZE_BYTES + 1, expectedSeconds })).toEqual({ ok: false, reason: "too_large" });
  });
});

describe("案内の文", () => {
  it("切り取れなかったときは、要件 4.5.17 の文を出す", () => {
    expect(trimFailureMessage("unreadable")).toBe(TRIM_FALLBACK_MESSAGE);
    expect(TRIM_FALLBACK_MESSAGE).toContain("写真アプリ");
    expect(TRIM_FALLBACK_MESSAGE).toContain("30 秒以内");
  });

  it("大きすぎるときは別の文 ── 短くしても直らないので、同じ案内では困る", () => {
    const message = trimFailureMessage("too_large", 62 * 1024 * 1024);
    expect(message).toContain("62MB");
    expect(message).toContain("50MB");
    expect(message).not.toBe(TRIM_FALLBACK_MESSAGE);
  });
});

describe("formatMegabytes", () => {
  it("小数 1 桁で出す", () => {
    expect(formatMegabytes(62 * 1024 * 1024)).toBe("62MB");
    expect(formatMegabytes(1.55 * 1024 * 1024)).toBe("1.6MB");
  });

  it("0 でも「0MB」とは言わない", () => {
    expect(formatMegabytes(0)).toBe("0.1MB");
  });
});
