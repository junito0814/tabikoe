import { randomBytes } from "node:crypto";

/**
 * F-RC-03 Task2〜4: 招待リンク
 * 出典: docs/tasks/records/album-collaboration/02-invitation-issue-handler.md
 *       docs/tasks/records/album-collaboration/04-invitation-acceptance-handler.md
 *       要件定義書3.6.3（有効期限7日間）
 */
export const INVITATION_TTL_DAYS = 7;

/** 発行時刻の7日後（単体テストの対象） */
export function computeInvitationExpiry(issuedAt: Date): Date {
  return new Date(issuedAt.getTime() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/** URL に載せる推測不能なトークン（32バイト → base64url 43文字） */
export function generateInvitationToken(): string {
  return randomBytes(32).toString("base64url");
}

export function buildInvitationPath(token: string): string {
  return `/invitations/${token}`;
}

export type InvitationValidity = "valid" | "revoked" | "expired";

/** 受諾可能か（単体テストの対象）。無効化済み・期限切れは 410 Gone */
export function evaluateInvitation(
  invitation: { expires_at: string; revoked_at: string | null },
  now: Date = new Date()
): InvitationValidity {
  if (invitation.revoked_at) return "revoked";
  if (new Date(invitation.expires_at).getTime() <= now.getTime()) return "expired";
  return "valid";
}
