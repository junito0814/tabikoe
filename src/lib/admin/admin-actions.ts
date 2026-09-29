import type { SupabaseClient } from "@supabase/supabase-js";
import { recordOperation } from "@/lib/logs/record-operation";

/**
 * user-management Task 4: 操作の記録（admin_actions）の書き込みと読み出し
 * 出典: docs/tasks/admin/user-management/04-admin-actions-log.md
 *       要件定義書 3.10.12「操作の記録」
 *
 * 【初心者向け】管理者の操作（通報対応・停止・復元・規約の公開・お知らせ）と自動処理（自動非公開・仮停止）は
 * すべて recordAdminAction() を通してここに残す。書き込みに失敗しても本来の操作は失敗させない
 * （operation_logs の recordOperation と同じ約束。失敗は console.error に残す）。
 * 管理者の操作は要件 7.5 の operation_logs（admin_action）にも同時に残すので、呼び出し側は 1 回呼べばよい。
 *
 * #585: 誰がやったかは actor_id（利用者への参照）だけでなく、**書き込み時の表示名（actor_label）も文字で持つ**。
 * その管理者が退会・削除されると actor_id は NULL になるが、台帳としては「誰がやったか」が残らないと意味がない。
 * 対象を target_label で文字に残しているのと同じ考え方。actor_label が無い行＝自動処理。
 */
export const ADMIN_ACTION_TYPES = [
  "report_hide",
  "report_delete",
  "report_no_issue",
  "auto_hide",
  "strike_add",
  "strike_revoke",
  "user_suspend",
  "user_provisional_suspend",
  "user_confirm_suspension",
  "user_unsuspend",
  "hidden_restore",
  "spot_fix_request",
  "announcement_create",
  "announcement_update",
  "announcement_delete",
  "legal_publish",
] as const;
export type AdminActionType = (typeof ADMIN_ACTION_TYPES)[number];

export const ADMIN_ACTION_LABELS: Record<AdminActionType, string> = {
  report_hide: "非公開化",
  report_delete: "削除",
  report_no_issue: "問題なし",
  auto_hide: "自動で非公開",
  strike_add: "ストライク付与",
  strike_revoke: "ストライク取り消し",
  user_suspend: "アカウント停止",
  user_provisional_suspend: "仮停止",
  user_confirm_suspension: "仮停止を確定",
  user_unsuspend: "停止を解除",
  hidden_restore: "復元",
  spot_fix_request: "修正を依頼",
  announcement_create: "お知らせを作成",
  announcement_update: "お知らせを編集",
  announcement_delete: "お知らせを削除",
  legal_publish: "規約を公開",
};

export type AdminActionTargetType = "post" | "comment" | "spot" | "trip" | "user" | "report" | "announcement" | "legal_document";

export function isAdminActionType(value: unknown): value is AdminActionType {
  return (ADMIN_ACTION_TYPES as readonly string[]).includes(String(value));
}

export interface RecordAdminActionInput {
  /** 誰が。null は自動処理 */
  actorId: string | null;
  action: AdminActionType;
  target?: { type: AdminActionTargetType; id: string | null; label: string } | null;
  /** 理由（管理者のメモ／自動処理の判定内容） */
  note?: string | null;
}

/** 1 行残す。例外は投げない */
export async function recordAdminAction(admin: SupabaseClient, input: RecordAdminActionInput): Promise<void> {
  try {
    // #585: 退会しても「誰がやったか」が残るよう、書き込み時の表示名も持つ（自動処理は null のまま）
    const actorLabel = input.actorId ? await displayNameOf(admin, input.actorId) : null;
    const { error } = await admin.from("admin_actions").insert({
      actor_id: input.actorId,
      actor_label: actorLabel,
      action: input.action,
      target_type: input.target?.type ?? null,
      target_id: input.target?.id ?? null,
      target_label: input.target?.label ?? null,
      note: input.note?.trim() ? input.note.trim() : null,
    });
    if (error) console.error("Failed to record admin action", input.action, error.message);
  } catch (error) {
    console.error("Failed to record admin action", input.action, error instanceof Error ? error.message : error);
  }
  // 要件 7.5 の操作ログ（管理者による対応操作）。自動処理（actorId null）は 7.5 の対象外なので残さない
  if (input.actorId) {
    await recordOperation(admin, {
      actionType: "admin_action",
      userId: input.actorId,
      targetId: input.target?.id ?? null,
      detail: { action: input.action, targetType: input.target?.type ?? null, note: input.note ?? null },
    });
  }
}

/** 記録に残す管理者の表示名。取れなければ null（記録自体は残す） */
async function displayNameOf(admin: SupabaseClient, userId: string): Promise<string | null> {
  try {
    const { data } = await admin.from("users").select("display_name").eq("id", userId).maybeSingle();
    return (data?.display_name as string | null) ?? null;
  } catch {
    return null;
  }
}

// ---- 読み出し（SC-27） ----

export const ADMIN_ACTIONS_PAGE_SIZE = 20;

export interface AdminActionFilters {
  /** 管理者の ID。"auto" は自動処理だけ */
  actor: string | "auto" | null;
  action: AdminActionType | null;
  from: string | null;
  to: string | null;
}

/** クエリ文字列 → 絞り込み条件（不正な値は無視。純粋関数） */
export function parseAdminActionFilters(searchParams: URLSearchParams): AdminActionFilters {
  const actor = searchParams.get("actor") ?? "";
  const action = searchParams.get("action") ?? "";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  return {
    actor: actor === "auto" ? "auto" : /^[0-9a-f-]{36}$/i.test(actor) ? actor : null,
    action: isAdminActionType(action) ? action : null,
    from: from && !Number.isNaN(Date.parse(from)) ? new Date(from).toISOString() : null,
    // 「まで」は その日いっぱい（翌日 0 時未満）
    to: to && !Number.isNaN(Date.parse(to)) ? endOfDayIso(to) : null,
  };
}

function endOfDayIso(value: string): string {
  const date = new Date(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) date.setHours(23, 59, 59, 999);
  return date.toISOString();
}

export interface AdminActionItem {
  id: string;
  actorId: string | null;
  /** 表示名。自動処理は「自動」、退会した管理者は「〈名前〉（退会済み）」 */
  actorName: string;
  /** 自動処理の行か（#585: actor_id が NULL でも、退会した管理者の行と区別する） */
  isAutomatic: boolean;
  action: AdminActionType;
  targetType: AdminActionTargetType | null;
  targetId: string | null;
  targetLabel: string | null;
  note: string | null;
  createdAt: string;
}

export async function listAdminActions(
  admin: SupabaseClient,
  filters: AdminActionFilters,
  offset: number,
  limit: number = ADMIN_ACTIONS_PAGE_SIZE
): Promise<{ actions: AdminActionItem[]; nextOffset: number | null }> {
  let query = admin
    .from("admin_actions")
    .select("id, actor_id, actor_label, action, target_type, target_id, target_label, note, created_at, actor:users(display_name)", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (filters.actor === "auto") query = query.is("actor_id", null);
  else if (filters.actor) query = query.eq("actor_id", filters.actor);
  if (filters.action) query = query.eq("action", filters.action);
  if (filters.from) query = query.gte("created_at", filters.from);
  if (filters.to) query = query.lte("created_at", filters.to);

  const { data, error, count } = await query;
  if (error) throw error;
  const actions = (data ?? []).map((row) => {
    const actor = row.actor as { display_name: string | null } | { display_name: string | null }[] | null;
    const name = Array.isArray(actor) ? actor[0]?.display_name : actor?.display_name;
    return {
      id: row.id as string,
      actorId: (row.actor_id as string | null) ?? null,
      ...resolveActor(row.actor_id as string | null, (row.actor_label as string | null) ?? null, name ?? null),
      action: row.action as AdminActionType,
      targetType: (row.target_type as AdminActionTargetType | null) ?? null,
      targetId: (row.target_id as string | null) ?? null,
      targetLabel: (row.target_label as string | null) ?? null,
      note: (row.note as string | null) ?? null,
      createdAt: row.created_at as string,
    };
  });
  const total = count ?? 0;
  return { actions, nextOffset: offset + actions.length < total ? offset + actions.length : null };
}

/**
 * #585: 「誰がやったか」の表示。純粋関数
 *   actor_label が無い          → 自動処理（「自動」）
 *   利用者が残っている          → いまの表示名
 *   利用者が消えている（NULL）  → 「〈記録した時の名前〉（退会済み）」
 */
export function resolveActor(
  actorId: string | null,
  actorLabel: string | null,
  currentName: string | null
): { actorName: string; isAutomatic: boolean } {
  if (!actorLabel && !actorId) return { actorName: "自動", isAutomatic: true };
  if (actorId) return { actorName: currentName ?? actorLabel ?? "（名前なし）", isAutomatic: false };
  return { actorName: `${actorLabel}（退会済み）`, isAutomatic: false };
}
