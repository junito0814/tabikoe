import { describe, expect, it } from "vitest";
import { computeInvitationExpiry, evaluateInvitation, generateInvitationToken } from "./invitations";

/**
 * 出典: docs/tasks/records/album-collaboration/02-invitation-issue-handler.md 単体テスト
 * - expires_at が発行時刻の7日後として正しく計算されることを検証する
 * 出典: docs/tasks/records/album-collaboration/04-invitation-acceptance-handler.md 単体テスト
 * - 期限切れ・無効化済みトークンでの受諾が拒否されることを検証する
 */
describe("computeInvitationExpiry", () => {
  it("発行時刻の7日後", () => {
    const issued = new Date("2026-09-14T10:00:00Z");
    expect(computeInvitationExpiry(issued).toISOString()).toBe("2026-09-21T10:00:00.000Z");
  });
});

describe("evaluateInvitation", () => {
  const now = new Date("2026-09-14T10:00:00Z");

  it("有効期限内かつ未無効化なら valid", () => {
    expect(evaluateInvitation({ expires_at: "2026-09-21T10:00:00Z", revoked_at: null }, now)).toBe("valid");
  });

  it("期限切れは expired", () => {
    expect(evaluateInvitation({ expires_at: "2026-09-14T10:00:00Z", revoked_at: null }, now)).toBe("expired");
    expect(evaluateInvitation({ expires_at: "2026-09-01T00:00:00Z", revoked_at: null }, now)).toBe("expired");
  });

  it("無効化済みは revoked（期限内でも）", () => {
    expect(
      evaluateInvitation({ expires_at: "2026-09-21T10:00:00Z", revoked_at: "2026-09-14T09:00:00Z" }, now)
    ).toBe("revoked");
  });
});

describe("generateInvitationToken", () => {
  it("推測しにくい長さで、毎回異なる", () => {
    const a = generateInvitationToken();
    const b = generateInvitationToken();
    expect(a).toHaveLength(43);
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
