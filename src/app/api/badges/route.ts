import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { getBadgeStatuses } from "@/lib/badges/badge-status";

/**
 * F-BG Task4: バッジ一覧の取得
 * 出典: docs/tasks/badges/status-badges/04-badge-screen-ui.md
 *
 * カタログの全バッジ種別と、ログインユーザーの獲得状況（acquiredAt）をマージして返す。
 */
export async function GET() {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const badges = await getBadgeStatuses(supabase, user.id);
    return NextResponse.json({ badges });
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
}
