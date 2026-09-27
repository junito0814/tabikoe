import type { SupabaseClient } from "@supabase/supabase-js";
import { createNotificationsForMany } from "./create-notification";
import type { NotificationType } from "./catalog";

/**
 * admin-shell-dashboard Task 4: 管理者全員に同じ通知を作る
 * 出典: docs/tasks/admin/admin-shell-dashboard/04-admin-notifications.md
 *       要件定義書 3.9.1「管理者への通知」
 *
 * 【初心者向け】通報が来ても一覧を開かない限り気づけなかったので、通報・自動非公開・仮停止のたびに
 * 管理者（is_admin = true）全員のアプリ内通知に 1 行ずつ足す。メールは使わない。
 * 通知の作成失敗で本来の操作（通報の受付など）を失敗させないよう、例外は投げない。
 */
export type AdminNotificationType = Extract<NotificationType, "admin_report" | "admin_auto_hidden" | "admin_suspended">;

export async function notifyAdmins(
  admin: SupabaseClient,
  input: { type: AdminNotificationType; relatedId: string; actorId?: string | null }
): Promise<{ created: number; failed: number }> {
  try {
    const { data, error } = await admin.from("users").select("id").eq("is_admin", true).eq("is_deleted", false);
    if (error) throw error;
    const recipientIds = (data ?? []).map((row) => row.id as string);
    if (recipientIds.length === 0) return { created: 0, failed: 0 };
    const result = await createNotificationsForMany(admin, {
      recipientIds,
      actorId: input.actorId ?? null,
      type: input.type,
      relatedId: input.relatedId,
    });
    return { created: result.created, failed: result.failed };
  } catch (error) {
    console.error("Failed to notify admins", input.type, error instanceof Error ? error.message : error);
    return { created: 0, failed: 1 };
  }
}
