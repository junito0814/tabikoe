import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * F-AC-03 Task1: ログアウト Route Handler
 * 出典: docs/tasks/account/logout/01-logout-route-handler.md
 *
 * 未ログイン状態での呼び出しはエラーとせず正常終了とする。
 */
export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
