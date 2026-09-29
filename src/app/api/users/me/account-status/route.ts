import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { getAccountStatus } from "@/lib/moderation/account-status";

/**
 * strike-system Task 5: GET /api/users/me/account-status（本人の状態）
 * 出典: docs/tasks/safety/strike-system/05-account-status.md
 */
export async function GET() {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await getAccountStatus(createAdminClient(), user.id));
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
}
