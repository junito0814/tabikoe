import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { graphemeLength } from "@/lib/text/grapheme-length";

const MAX_DISPLAY_NAME_LENGTH = 200;

/**
 * F-AC-04 Task1: ユーザー名更新 Route Handler
 * 出典: docs/tasks/account/profile-edit/01-display-name-update-handler.md
 */
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let displayName: unknown;
  try {
    const body = await request.json();
    displayName = body?.displayName;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (typeof displayName !== "string" || displayName.trim().length === 0) {
    return NextResponse.json({ error: "display_name_required" }, { status: 400 });
  }

  if (graphemeLength(displayName) > MAX_DISPLAY_NAME_LENGTH) {
    return NextResponse.json({ error: "display_name_too_long" }, { status: 400 });
  }

  // RLS「users_update_own」により、本人の行のみ更新できる
  const { error: updateError } = await supabase
    .from("users")
    .update({ display_name: displayName })
    .eq("id", user.id);

  if (updateError) {
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ displayName });
}
