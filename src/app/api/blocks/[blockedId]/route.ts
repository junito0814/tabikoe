import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";

/**
 * F-SF-02 Task1: ブロックの解除
 * 出典: docs/tasks/safety/blocking/01-block-unblock-handler.md
 *
 * RLS により自分が blocker の行しか消せない。他人のブロックは対象にならず、
 * 存在しない場合も含めて削除件数0なら404を返す。
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ blockedId: string }> }
) {
  const { blockedId } = await params;
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("blocks")
    .delete()
    .eq("blocker_id", user.id)
    .eq("blocked_id", blockedId)
    .select("id");

  if (error) {
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
