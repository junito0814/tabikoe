import type { SupabaseClient } from "@supabase/supabase-js";
import type { NotificationType } from "./catalog";

/**
 * F-NT-01 Task1: 通知作成の共通関数
 * 出典: docs/tasks/notifications/notification-triggers/01-notification-helper.md
 *       要件定義書3.9.1、5.3「通知の実装」
 *
 * 各機能のRoute Handlerがイベント発生時に呼ぶ。notifications への INSERT を
 * ここに集約し、3.9.1の「自分自身の操作を除く」ガードも呼び出し側でなくここで持つ。
 *
 * 書き込みは service_role で行う（notifications への INSERT は authenticated に許していない）。
 * 通知の作成失敗で本来の操作（コメント投稿等）を失敗させないため、例外は投げない。
 */
export interface CreateNotificationInput {
  /** 通知を受け取るユーザー */
  recipientId: string;
  /** 通知を発生させた行為者。recipientId と同一なら何もしない（3.9.1） */
  actorId?: string | null;
  type: NotificationType;
  /** カタログの規則に従った対象レコードのID */
  relatedId: string;
}

export type CreateNotificationResult = "created" | "skipped_self" | "failed";

export async function createNotification(
  admin: SupabaseClient,
  input: CreateNotificationInput
): Promise<CreateNotificationResult> {
  if (input.actorId && input.actorId === input.recipientId) {
    return "skipped_self";
  }

  try {
    const { error } = await admin.from("notifications").insert({
      user_id: input.recipientId,
      type: input.type,
      related_id: input.relatedId,
      is_read: false,
    });

    if (error) {
      console.error("Failed to create notification", input.type, error.message);
      return "failed";
    }
    return "created";
  } catch (error) {
    console.error("Failed to create notification", input.type, error);
    return "failed";
  }
}

/**
 * 複数人に同じ通知を送る（例：アルバム参加はオーナーと既存メンバー全員へ、3.9.1）。
 * 受信者の重複は1件に畳み、行為者本人は除外する。
 */
export async function createNotificationsForMany(
  admin: SupabaseClient,
  input: Omit<CreateNotificationInput, "recipientId"> & { recipientIds: readonly string[] }
): Promise<{ created: number; skipped: number; failed: number }> {
  const uniqueRecipients = Array.from(new Set(input.recipientIds)).filter(
    (recipientId) => recipientId !== input.actorId
  );

  const summary = { created: 0, skipped: input.recipientIds.length - uniqueRecipients.length, failed: 0 };

  for (const recipientId of uniqueRecipients) {
    const result = await createNotification(admin, { ...input, recipientId });
    if (result === "created") summary.created += 1;
    else if (result === "failed") summary.failed += 1;
    else summary.skipped += 1;
  }

  return summary;
}
