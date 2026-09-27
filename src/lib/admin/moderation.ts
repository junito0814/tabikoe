import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReportTargetType } from "@/lib/reports/constants";
import { removeStorageObjects } from "@/lib/posts/photos";
import type { ReportStatus } from "./report-filters";

/**
 * F-AD-05 Task1: 通報対応操作の読み替え
 * 出典: docs/tasks/admin/report-handling/01-report-action-handler.md
 *       要件定義書3.10.5
 *
 * 非公開化は復元可能な論理非公開化（hidden_at 等）、削除は復元不可。
 * ユーザー → アカウントの一時停止、スポット → スポットの非公開化、アルバム → アルバムの非公開化として読み替える
 * （スポット・アルバムは投稿から参照されるため「削除」でも物理削除はせず非公開化に倒す）。
 */
export const MODERATION_ACTIONS = ["hide", "delete", "no_issue"] as const;
export type ModerationAction = (typeof MODERATION_ACTIONS)[number];

export const MODERATION_ACTION_LABELS: Record<ModerationAction, string> = {
  hide: "非公開化",
  delete: "削除",
  no_issue: "問題なし",
};

export function isModerationAction(value: unknown): value is ModerationAction {
  return (MODERATION_ACTIONS as readonly string[]).includes(String(value));
}

/** 対象に対して実際に行う処理（単体テストで読み替えを検証する） */
export type ModerationEffect =
  | { kind: "hide"; table: "posts" | "post_photos" | "comments" | "spots" | "trips"; column: "hidden_at" | "review_hidden_at" }
  | { kind: "delete"; table: "posts" | "post_photos" | "comments" }
  | { kind: "clear_review"; table: "posts" }
  | { kind: "suspend_user" }
  | { kind: "none" };

export function planModerationEffect(targetType: ReportTargetType, action: ModerationAction): ModerationEffect {
  if (action === "no_issue") return { kind: "none" };

  switch (targetType) {
    case "post":
      return action === "hide" ? { kind: "hide", table: "posts", column: "hidden_at" } : { kind: "delete", table: "posts" };
    case "post_photo":
      return action === "hide"
        ? { kind: "hide", table: "post_photos", column: "hidden_at" }
        : { kind: "delete", table: "post_photos" };
    case "post_review":
      // 感想テキストのみ。非公開化は表示を伏せ、削除は本文を消す
      return action === "hide"
        ? { kind: "hide", table: "posts", column: "review_hidden_at" }
        : { kind: "clear_review", table: "posts" };
    case "comment":
      return action === "hide" ? { kind: "hide", table: "comments", column: "hidden_at" } : { kind: "delete", table: "comments" };
    case "user":
      // 非公開化・削除のいずれもアカウントの一時停止として扱う
      return { kind: "suspend_user" };
    case "spot":
      return { kind: "hide", table: "spots", column: "hidden_at" };
    case "trip":
      return { kind: "hide", table: "trips", column: "hidden_at" };
  }
}

/** 対応操作 → reports.status */
export function resolveReportStatus(action: ModerationAction): ReportStatus {
  switch (action) {
    case "hide":
      return "resolved_hidden";
    case "delete":
      return "resolved_deleted";
    case "no_issue":
      return "no_issue";
  }
}

/** 通報者へ通知するのは「削除」の場合のみ（3.10.5）。被通報者へは送らない */
export function shouldNotifyReporter(action: ModerationAction): boolean {
  return action === "delete";
}

/** 読み替えた処理を実行する。対象が既に無い場合もエラーにしない（冪等） */
export async function applyModerationEffect(
  admin: SupabaseClient,
  effect: ModerationEffect,
  targetId: string,
  now: Date = new Date()
): Promise<void> {
  switch (effect.kind) {
    case "none":
      return;
    case "hide": {
      // strike-system Task 3: 投稿・コメントは「誰の判断で隠したか」（hidden_reason）も残す。自動非公開の上書きも管理者の判断になる
      const payload: Record<string, unknown> = { [effect.column]: now.toISOString() };
      if ((effect.table === "posts" || effect.table === "comments") && effect.column === "hidden_at") payload.hidden_reason = "moderation";
      const { error } = await admin.from(effect.table).update(payload).eq("id", targetId);
      if (error) throw error;
      return;
    }
    case "clear_review": {
      const { error } = await admin.from("posts").update({ comment: null }).eq("id", targetId);
      if (error) throw error;
      return;
    }
    case "suspend_user": {
      const { error } = await admin.from("users").update({ suspended_at: now.toISOString() }).eq("id", targetId);
      if (error) throw error;
      return;
    }
    case "delete": {
      if (effect.table === "post_photos") {
        const { data: photo } = await admin.from("post_photos").select("storage_url").eq("id", targetId).maybeSingle();
        const { error } = await admin.from("post_photos").delete().eq("id", targetId);
        if (error) throw error;
        if (photo?.storage_url) await removeStorageObjects(admin, [photo.storage_url]);
        return;
      }
      if (effect.table === "posts") {
        const { data: photos } = await admin.from("post_photos").select("storage_url").eq("post_id", targetId);
        const { error } = await admin.from("posts").delete().eq("id", targetId);
        if (error) throw error;
        const paths = (photos ?? []).flatMap((p) => (p.storage_url ? [p.storage_url as string] : []));
        if (paths.length > 0) await removeStorageObjects(admin, paths);
        return;
      }
      const { error } = await admin.from(effect.table).delete().eq("id", targetId);
      if (error) throw error;
      return;
    }
  }
}
