import { describe, expect, it } from "vitest";
import {
  differsFromReporter,
  formatUrgency,
  isReportReason,
  MIN_CONFIDENCE,
  oldestOpenDays,
  shouldShowReason,
  urgencyLevel,
} from "./triage-report";

/**
 * #892 / 要件 6.8（2026-10-11）: Jev の見立てを画面に出すかどうかの判断。
 *
 * 【初心者向け】ここで見張るのは「**黙るべきときに黙れるか**」です。
 *   自信の無い見立てを並べると、運営者が**それを信じて間違えます**。
 *   出さないほうが良い場面を、数字だけで固めておきます。
 *
 * 境目の数字は実測から決めました（2026-10-11・日本語の通報 4 件）。
 *   電話番号 2.79 ／ 顔の写り込み 2.23 ／ 宣伝 1.53 ／ ただの感想 0.28
 */
const verdict = (reason: string | null, confidence: number | null) => ({ urgency: 2, reason, confidence });

describe("urgencyLevel", () => {
  it("実測した 4 件が、思ったとおりの段に入る", () => {
    expect(urgencyLevel(2.79)).toBe("high"); // 電話番号が書かれている
    expect(urgencyLevel(2.23)).toBe("mid"); // 顔の写り込み
    expect(urgencyLevel(1.53)).toBe("mid"); // 宣伝の繰り返し
    expect(urgencyLevel(0.28)).toBe("low"); // ただの感想
  });

  it("境目はその段に入る", () => {
    expect(urgencyLevel(2.5)).toBe("high");
    expect(urgencyLevel(1.5)).toBe("mid");
    expect(urgencyLevel(1.49)).toBe("low");
  });
});

describe("formatUrgency", () => {
  it("小数 1 桁にする", () => {
    expect(formatUrgency(2.79)).toBe("2.8");
    expect(formatUrgency(0)).toBe("0.0");
  });
});

describe("isReportReason", () => {
  it("8 択に無い言葉は受け付けない", () => {
    expect(isReportReason("personal_info")).toBe(true);
    expect(isReportReason("危険な行為")).toBe(false);
    expect(isReportReason(null)).toBe(false);
  });
});

describe("shouldShowReason（迷ったら黙る）", () => {
  it("確信が高ければ出す", () => {
    expect(shouldShowReason(verdict("personal_info", 1))).toBe(true);
    expect(shouldShowReason(verdict("spam", MIN_CONFIDENCE))).toBe(true);
  });

  it("確信が足りなければ出さない", () => {
    expect(shouldShowReason(verdict("personal_info", 0.69))).toBe(false);
    expect(shouldShowReason(verdict("personal_info", null))).toBe(false);
  });

  it("**「その他」は確信が高くても出さない**", () => {
    // Jev にとっての「その他」は「どれでもない」。運営者が次にすることが何も変わらない
    expect(shouldShowReason(verdict("other", 1))).toBe(false);
  });

  it("呼べなかった通報（null）は出さない", () => {
    expect(shouldShowReason(verdict(null, null))).toBe(false);
  });

  it("知らない言葉が来ても出さない（保存されていても信じない）", () => {
    expect(shouldShowReason(verdict("危険な行為", 1))).toBe(false);
  });
});

describe("differsFromReporter（ここがいちばん値打ちのあるところ）", () => {
  it("通報者の選んだ理由と違えば true", () => {
    // 2026-10-04 の実測: 利用者が「その他」で送った通報を、Jev は個人情報だと見立て直した
    expect(differsFromReporter("other", verdict("personal_info", 1))).toBe(true);
  });

  it("同じなら false（合っているときの見立ては、ただの重複）", () => {
    expect(differsFromReporter("spam", verdict("spam", 1))).toBe(false);
  });

  it("出さないと決めたものは、食い違いにもしない", () => {
    expect(differsFromReporter("spam", verdict("personal_info", 0.5))).toBe(false);
    expect(differsFromReporter("spam", verdict("other", 1))).toBe(false);
  });
});

describe("oldestOpenDays（古い通報を埋もれさせない）", () => {
  const now = new Date("2026-10-11T12:00:00Z");

  it("いちばん古いものが何日前かを返す", () => {
    expect(oldestOpenDays(["2026-10-06T12:00:00Z", "2026-10-10T12:00:00Z"], now)).toBe(5);
  });

  it("1 件も無ければ null（帯を出さない）", () => {
    expect(oldestOpenDays([], now)).toBeNull();
  });

  it("読めない日付は数えない", () => {
    expect(oldestOpenDays(["こわれた日付", "2026-10-09T12:00:00Z"], now)).toBe(2);
  });
});
