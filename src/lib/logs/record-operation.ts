import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * data-model/table-catalog Task6: 操作ログの共通書き込みヘルパー
 * 出典: docs/tasks/data-model/table-catalog/06-operation-logs-table.md
 *       要件定義書7.5（対象操作・保存期間90日・閲覧は管理者のみ）
 *
 * 各機能のRoute Handlerが操作完了時に呼ぶ。書き込みは service_role で行うため、
 * 呼び出し側は createAdminClient() のクライアントを渡すこと。
 *
 * ログの書き込み失敗で本来の操作（投稿・ログイン等）を失敗させてはならないため、
 * この関数は例外を投げない。失敗は console.error に残すだけにする。
 */
export const OPERATION_ACTION_TYPES = [
  "login_success",
  "login_failure",
  "post_create",
  "post_update",
  "post_delete",
  "comment_create",
  "comment_delete",
  "report_create",
  "account_create",
  "account_delete",
  "admin_action",
] as const;

export type OperationActionType = (typeof OPERATION_ACTION_TYPES)[number];

export interface OperationLogEntry {
  actionType: OperationActionType;
  /** ログイン失敗など、ユーザーが確定しない操作では省略する */
  userId?: string | null;
  /** 対象レコードのID（投稿ID・コメントID等） */
  targetId?: string | null;
  /** 付随情報。個人情報や認証情報は入れない */
  detail?: Record<string, unknown> | null;
}

export async function recordOperation(
  admin: SupabaseClient,
  entry: OperationLogEntry
): Promise<void> {
  try {
    const { error } = await admin.from("operation_logs").insert({
      user_id: entry.userId ?? null,
      action_type: entry.actionType,
      target_id: entry.targetId ?? null,
      detail: entry.detail ?? null,
    });

    if (error) {
      console.error("Failed to record operation log", entry.actionType, error.message);
    }
  } catch (error) {
    console.error("Failed to record operation log", entry.actionType, error);
  }
}
