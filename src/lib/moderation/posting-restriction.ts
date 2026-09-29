import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { isPostingRestricted } from "./strike-rules";

/**
 * strike-system Task 2: 投稿・コメント禁止の判定（API 側）
 * 出典: docs/tasks/safety/strike-system/02-strike-on-resolve.md
 *       要件定義書 3.10.7（有効 2 で 3 日、3 で 7 日、4 で 30 日の投稿・コメント禁止）
 *
 * 【初心者向け】「投稿禁止」は投稿とコメントの**作成**だけを止める。閲覧・保存・しおりは通る。
 * 判定は画面ではなく API で行う（画面だけ止めても直接叩けるため）。制限中なら 403 と解除日時を返し、
 * 画面はそれを見て理由と解除日を出す。
 */
export const POSTING_RESTRICTED_ERROR = "posting_restricted";

/** 制限中なら解除日時（ISO）、そうでなければ null。読めなければ止めない（本来の操作を巻き込まない） */
export async function getPostingRestrictionUntil(admin: SupabaseClient, userId: string, now: Date = new Date()): Promise<string | null> {
  try {
    const { data, error } = await admin.from("users").select("posting_restricted_until").eq("id", userId).maybeSingle();
    if (error) throw error;
    const until = (data?.posting_restricted_until as string | null | undefined) ?? null;
    return isPostingRestricted(until, now) ? until : null;
  } catch (error) {
    console.error("[moderation] 投稿禁止の判定に失敗しました:", error instanceof Error ? error.message : error);
    return null;
  }
}

export function postingRestrictedResponse(until: string): NextResponse {
  return NextResponse.json({ error: POSTING_RESTRICTED_ERROR, until }, { status: 403 });
}

/** 画面用の文言（純粋関数） */
export function postingRestrictedMessage(until: string): string {
  const d = new Date(until);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `いまは投稿・コメントができません（${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())} まで）。理由はマイページの「アカウントの状態」で確認できます`;
}
