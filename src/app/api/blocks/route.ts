import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";

/**
 * F-SF-02 Task1: ブロックの作成
 * 出典: docs/tasks/safety/blocking/01-block-unblock-handler.md
 *
 * blocks への INSERT は RLS（blocks_owner_all: blocker_id = auth.uid()）が効くため
 * ユーザースコープのクライアントで行い、他人名義のブロックを作れないようにする。
 * 一意制約 (blocker_id, blocked_id) により重複はDB側で弾かれる。
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { blockedId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const blockedId = typeof body.blockedId === "string" ? body.blockedId : "";
  if (blockedId.length === 0) {
    return NextResponse.json({ error: "blocked_id_required" }, { status: 400 });
  }
  if (blockedId === user.id) {
    return NextResponse.json({ error: "cannot_block_self" }, { status: 400 });
  }

  // 対象が実在するユーザーであることを確認する（usersのRLSは本人行しか見せないためservice_roleで）
  const admin = createAdminClient();
  const { data: target } = await admin
    .from("users")
    .select("id")
    .eq("id", blockedId)
    .maybeSingle();
  if (!target) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("blocks")
    .insert({ blocker_id: user.id, blocked_id: blockedId });

  if (error) {
    // 23505 = unique_violation（既にブロック済み）
    if (error.code === "23505") {
      return NextResponse.json({ error: "already_blocked" }, { status: 409 });
    }
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
