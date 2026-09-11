import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { getWishlistItems } from "@/lib/wishlist/get-wishlist-items";

/**
 * F-RC-05 Task2: 「行きたい」スポット一覧の取得
 * 出典: docs/tasks/records/wishlist/02-wishlist-list-screen.md
 */
export async function GET() {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const items = await getWishlistItems(createAdminClient(), user.id);
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
}

/**
 * F-RC-05 Task1: 「行きたい」の保存
 * 出典: docs/tasks/records/wishlist/01-wishlist-toggle-handler.md
 *
 * スポット単位で保存する。投稿の有無・Places由来か手動登録かは問わない（3.6.4）。
 * 既に保存済みのスポットへの再保存は一意制約違反になるが、エラーにせず冪等に200を返す。
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { spotId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const spotId = body.spotId;
  if (typeof spotId !== "string" || spotId.length === 0) {
    return NextResponse.json({ error: "spot_id_required" }, { status: 400 });
  }

  // スポットは登録済みのものだけを受け付ける（Places候補は先に POST /api/spots で登録する）
  const admin = createAdminClient();
  const { data: spot } = await admin.from("spots").select("id").eq("id", spotId).maybeSingle();
  if (!spot) {
    return NextResponse.json({ error: "spot_not_found" }, { status: 404 });
  }

  // RLS（wishlist_owner_all）に従わせるためユーザー権限で作成する
  const { error } = await supabase.from("wishlist").insert({ user_id: user.id, spot_id: spotId });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ saved: true, alreadySaved: true });
    }
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  return NextResponse.json({ saved: true, alreadySaved: false }, { status: 201 });
}
