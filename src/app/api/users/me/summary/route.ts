import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { getMyPageSummary } from "@/lib/users/my-page";

/**
 * F-RC-01 Task2: サマリー（投稿数・獲得いいね総数）
 * 出典: docs/tasks/records/my-page/02-summary-aggregation-handler.md
 */
export async function GET() {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const summary = await getMyPageSummary(createAdminClient(), user.id);
    return NextResponse.json({ summary });
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
}
