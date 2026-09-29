import { describe, expect, it } from "vitest";
import {
  ADMIN_SESSION_MAX_AGE_SECONDS,
  ADMIN_STEP_UP_MAX_AGE_SECONDS,
  adminGateDecision,
  needsStepUp,
  type AdminGateInput,
} from "./mfa-gate";

/** 出典: docs/tasks/admin/admin-login/04-mfa-decision-rules.md 単体テスト */
const NOW = Date.parse("2026-09-29T12:00:00.000Z");
const minutesAgo = (n: number) => NOW - n * 60 * 1000;

/** 「通る」状態を既定にして、試したい 1 つだけを崩す */
function gate(overrides: Partial<AdminGateInput> = {}) {
  return adminGateDecision({
    isAdmin: true,
    aal: "aal2",
    hasFactor: true,
    verifiedAt: minutesAgo(1),
    now: NOW,
    ...overrides,
  });
}

describe("しきい値", () => {
  it("60 分と 10 分を定数として持つ（判定の中に直書きしない）", () => {
    expect(ADMIN_SESSION_MAX_AGE_SECONDS).toBe(3600);
    expect(ADMIN_STEP_UP_MAX_AGE_SECONDS).toBe(600);
  });
});

describe("adminGateDecision", () => {
  it("すべて満たしていれば通す", () => {
    expect(gate()).toBe("allow");
  });

  it("is_admin が false なら、ほかの値がどうであれ 404（画面の存在を知らせない）", () => {
    // 管理者判定が最優先であること。hasFactor・aal・verifiedAt のどの組み合わせでも変わらない
    for (const hasFactor of [true, false]) {
      for (const aal of ["aal1", "aal2", null, undefined]) {
        for (const verifiedAt of [minutesAgo(1), minutesAgo(999), null]) {
          expect(gate({ isAdmin: false, hasFactor, aal, verifiedAt })).toBe("not_found");
        }
      }
    }
  });

  it("認証アプリが未登録なら登録へ送る", () => {
    expect(gate({ hasFactor: false })).toBe("enroll");
    // 未登録が先。aal が aal1 でも「確認」ではなく「登録」
    expect(gate({ hasFactor: false, aal: "aal1" })).toBe("enroll");
  });

  it("登録済みで aal2 でなければ 6 桁を聞く", () => {
    expect(gate({ aal: "aal1" })).toBe("verify");
    expect(gate({ aal: null })).toBe("verify");
    expect(gate({ aal: undefined })).toBe("verify");
    expect(gate({ aal: "AAL2" })).toBe("verify"); // 大文字は別の値として扱う
  });

  it("確認から 59 分なら通し、61 分なら聞き直す（60 分の境界）", () => {
    expect(gate({ verifiedAt: minutesAgo(59) })).toBe("allow");
    expect(gate({ verifiedAt: minutesAgo(60) })).toBe("allow"); // ちょうど 60 分は通す
    expect(gate({ verifiedAt: minutesAgo(61) })).toBe("verify");
  });

  it("確認時刻が分からない・信用できない値なら通さない（安全側に倒す）", () => {
    expect(gate({ verifiedAt: null })).toBe("verify");
    expect(gate({ verifiedAt: undefined })).toBe("verify");
    expect(gate({ verifiedAt: Number.NaN })).toBe("verify");
    expect(gate({ verifiedAt: Number.POSITIVE_INFINITY })).toBe("verify");
    // 未来の時刻で期限を延ばせないこと（Cookie を書き換えられた場合）
    expect(gate({ verifiedAt: NOW + 1000 })).toBe("verify");
  });
});

describe("needsStepUp", () => {
  it("9 分前なら聞かない、11 分前なら聞く（10 分の境界）", () => {
    expect(needsStepUp({ lastVerifiedAt: minutesAgo(9), now: NOW })).toBe(false);
    expect(needsStepUp({ lastVerifiedAt: minutesAgo(10), now: NOW })).toBe(false);
    expect(needsStepUp({ lastVerifiedAt: minutesAgo(11), now: NOW })).toBe(true);
  });

  it("一度も入れていない・信用できない値なら聞く", () => {
    expect(needsStepUp({ lastVerifiedAt: null, now: NOW })).toBe(true);
    expect(needsStepUp({ lastVerifiedAt: undefined, now: NOW })).toBe(true);
    expect(needsStepUp({ lastVerifiedAt: Number.NaN, now: NOW })).toBe(true);
    expect(needsStepUp({ lastVerifiedAt: NOW + 1000, now: NOW })).toBe(true);
  });
});
