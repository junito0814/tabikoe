import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAdminAction } from "@/lib/admin/admin-actions";
import { createNotification } from "@/lib/notifications/create-notification";
import { loadModerationSettings } from "@/lib/moderation/settings";
import { activeStrikes, measureForStrikeCount, type ModerationSettings, type StrikeLike } from "@/lib/moderation/strike-rules";

/**
 * user-management Task 2: アカウントへの操作（停止・解除・仮停止の確定・ストライクの取り消し）
 * 出典: docs/tasks/admin/user-management/02-user-detail-actions.md
 *       要件定義書 3.10.9、3.10.7「取り消し」、3.9.1「本人への通知」
 *
 * 【初心者向け】どの操作も「理由（メモ）が必須 → DB を更新 → 本人に通知 → 操作の記録」の順。
 * 理由の必須チェックは Route Handler で行い（空なら 400）、ここは理由が入っている前提で動く。
 * 管理者を停止できない守りは付けない（2026-09-27 の決定）。
 */
export const MAX_ACTION_NOTE_LENGTH = 1000;

/** 理由（メモ）の検証。純粋関数 */
export function validateActionNote(value: unknown): { ok: true; note: string } | { ok: false; error: "note_required" | "note_too_long" } {
  const note = typeof value === "string" ? value.trim() : "";
  if (!note) return { ok: false, error: "note_required" };
  if ([...note].length > MAX_ACTION_NOTE_LENGTH) return { ok: false, error: "note_too_long" };
  return { ok: true, note };
}

/**
 * 有効なストライクから「いまの投稿禁止の解除日時」を決め直す（取り消しの後に使う。純粋関数）。
 * いちばん新しい有効なストライクの付与日 ＋ その個数に応じた日数。過去なら制限なし（null）。
 */
export function restrictionAfterRecount(strikes: readonly StrikeLike[], settings: ModerationSettings, now: Date): string | null {
  const active = activeStrikes(strikes, now);
  const measure = measureForStrikeCount(active.length, settings);
  if (measure.kind !== "restrict") return null;
  const newest = active.reduce((latest, s) => (s.createdAt > latest ? s.createdAt : latest), active[0].createdAt);
  const until = new Date(new Date(newest).getTime() + measure.days * 86400000);
  return until.getTime() > now.getTime() ? until.toISOString() : null;
}

async function displayNameOf(admin: SupabaseClient, userId: string): Promise<string> {
  const { data } = await admin.from("users").select("display_name").eq("id", userId).maybeSingle();
  return (data?.display_name as string | null) ?? "（名前なし）";
}

/** アカウントを停止する（管理者の判断＝confirmed）。hidePosts なら公開投稿をまとめて非公開に */
export async function suspendUser(
  admin: SupabaseClient,
  input: { adminId: string; userId: string; note: string; hidePosts: boolean; now?: Date }
): Promise<{ hiddenPosts: number }> {
  const now = input.now ?? new Date();
  const { error } = await admin
    .from("users")
    .update({ suspended_at: now.toISOString(), suspension_kind: "confirmed" })
    .eq("id", input.userId);
  if (error) throw error;

  let hiddenPosts = 0;
  if (input.hidePosts) {
    const { data, error: hideError } = await admin
      .from("posts")
      .update({ hidden_at: now.toISOString(), hidden_reason: "suspension" })
      .eq("user_id", input.userId)
      .eq("status", "published")
      .is("hidden_at", null)
      .select("id");
    if (hideError) throw hideError;
    hiddenPosts = data?.length ?? 0;
  }

  await createNotification(admin, { recipientId: input.userId, actorId: null, type: "account_suspended", relatedId: input.userId });
  await recordAdminAction(admin, {
    actorId: input.adminId,
    action: "user_suspend",
    target: { type: "user", id: input.userId, label: await displayNameOf(admin, input.userId) },
    note: input.hidePosts ? `${input.note}（公開投稿 ${hiddenPosts} 件を非公開）` : input.note,
  });
  return { hiddenPosts };
}

/** 停止を解除する。restorePosts なら停止で隠した投稿だけ戻す */
export async function unsuspendUser(
  admin: SupabaseClient,
  input: { adminId: string; userId: string; note: string; restorePosts: boolean }
): Promise<{ restoredPosts: number }> {
  const { error } = await admin.from("users").update({ suspended_at: null, suspension_kind: null }).eq("id", input.userId);
  if (error) throw error;

  let restoredPosts = 0;
  if (input.restorePosts) {
    const { data, error: restoreError } = await admin
      .from("posts")
      .update({ hidden_at: null, hidden_reason: null })
      .eq("user_id", input.userId)
      .eq("hidden_reason", "suspension")
      .select("id");
    if (restoreError) throw restoreError;
    restoredPosts = data?.length ?? 0;
  }

  await createNotification(admin, { recipientId: input.userId, actorId: null, type: "account_unsuspended", relatedId: input.userId });
  await recordAdminAction(admin, {
    actorId: input.adminId,
    action: "user_unsuspend",
    target: { type: "user", id: input.userId, label: await displayNameOf(admin, input.userId) },
    note: input.restorePosts ? `${input.note}（投稿 ${restoredPosts} 件を復元）` : input.note,
  });
  return { restoredPosts };
}

/** 仮停止（自動）を管理者が確定する。挙動は変わらず、記録が「確定」になる */
export async function confirmSuspension(admin: SupabaseClient, input: { adminId: string; userId: string; note: string }): Promise<void> {
  const { error } = await admin.from("users").update({ suspension_kind: "confirmed" }).eq("id", input.userId).eq("suspension_kind", "provisional");
  if (error) throw error;
  await recordAdminAction(admin, {
    actorId: input.adminId,
    action: "user_confirm_suspension",
    target: { type: "user", id: input.userId, label: await displayNameOf(admin, input.userId) },
    note: input.note,
  });
}

/** ストライクを取り消し、投稿禁止の解除日時を決め直す */
export async function revokeStrike(
  admin: SupabaseClient,
  input: { adminId: string; strikeId: string; note: string; now?: Date }
): Promise<{ userId: string; postingRestrictedUntil: string | null } | null> {
  const now = input.now ?? new Date();
  const { data: strike, error } = await admin.from("strikes").select("id, user_id, revoked_at").eq("id", input.strikeId).maybeSingle();
  if (error) throw error;
  if (!strike) return null;

  if (!strike.revoked_at) {
    const { error: revokeError } = await admin
      .from("strikes")
      .update({ revoked_at: now.toISOString(), revoked_by: input.adminId, revoke_note: input.note })
      .eq("id", input.strikeId);
    if (revokeError) throw revokeError;
  }

  const userId = strike.user_id as string;
  const [{ data: rows }, settings] = await Promise.all([
    admin.from("strikes").select("created_at, expires_at, revoked_at").eq("user_id", userId),
    loadModerationSettings(admin),
  ]);
  const strikes: StrikeLike[] = ((rows ?? []) as { created_at: string; expires_at: string; revoked_at: string | null }[]).map((r) => ({
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    revokedAt: r.revoked_at,
  }));
  const postingRestrictedUntil = restrictionAfterRecount(strikes, settings, now);
  const { error: updateError } = await admin.from("users").update({ posting_restricted_until: postingRestrictedUntil }).eq("id", userId);
  if (updateError) throw updateError;

  await recordAdminAction(admin, {
    actorId: input.adminId,
    action: "strike_revoke",
    target: { type: "user", id: userId, label: await displayNameOf(admin, userId) },
    note: input.note,
  });
  return { userId, postingRestrictedUntil };
}
