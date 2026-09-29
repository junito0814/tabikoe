import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAdminAction } from "@/lib/admin/admin-actions";
import { createNotification } from "@/lib/notifications/create-notification";
import { notifyAdmins } from "@/lib/notifications/notify-admins";

/**
 * strike-system Task 4: 仮停止（自動）
 * 出典: docs/tasks/safety/strike-system/04-provisional-suspension.md
 *       要件定義書 3.10.7（有効 5 で仮停止・重大な違反は 1 回で）・3.10.8・3.10.9
 *
 * 【初心者向け】仮停止と停止の違いは「誰が判断したか」の記録（suspension_kind）だけ。利用者から見た挙動は同じで、
 * proxy.ts が suspended_at を見てログインを止める。管理者は利用者詳細（#554）で「仮停止を確定」か「解除」を選ぶ。
 * 既に停止中なら二重に記録しない（冪等）。
 */
export async function provisionallySuspend(
  admin: SupabaseClient,
  input: { userId: string; reason: string; now?: Date }
): Promise<{ suspended: boolean }> {
  const now = input.now ?? new Date();
  // まだ止まっていない人だけ止める
  const { data: updated, error } = await admin
    .from("users")
    .update({ suspended_at: now.toISOString(), suspension_kind: "provisional" })
    .eq("id", input.userId)
    .is("suspended_at", null)
    .select("id");
  if (error) throw error;
  if (!updated || updated.length === 0) return { suspended: false };

  // 本人へ（停止中はログインできないので、解除後に読める）、管理者全員へ（確認待ち）
  await createNotification(admin, { recipientId: input.userId, actorId: null, type: "account_suspended", relatedId: input.userId });
  await notifyAdmins(admin, { type: "admin_suspended", relatedId: input.userId });
  await recordAdminAction(admin, {
    actorId: null,
    action: "user_provisional_suspend",
    target: { type: "user", id: input.userId, label: await displayNameOf(admin, input.userId) },
    note: input.reason,
  });
  return { suspended: true };
}

async function displayNameOf(admin: SupabaseClient, userId: string): Promise<string> {
  const { data } = await admin.from("users").select("display_name").eq("id", userId).maybeSingle();
  return (data?.display_name as string | null) ?? "（名前なし）";
}
