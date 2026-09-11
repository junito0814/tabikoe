import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";

/**
 * F-RC-05 Task1: 「行きたい」の取消
 * 出典: docs/tasks/records/wishlist/01-wishlist-toggle-handler.md
 *
 * 保存と同様に冪等。未保存のスポットに対する取消もエラーにせず200を返す
 * （ボタンの二重押下や別端末での取消後でも、画面側は「未保存」に揃えばよい）。
 * RLS により自分の行しか消えない。
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ spotId: string }> }
) {
  const { spotId } = await params;
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("wishlist")
    .delete()
    .eq("user_id", user.id)
    .eq("spot_id", spotId)
    .select("id");

  if (error) {
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }

  return NextResponse.json({ saved: false, removed: (data?.length ?? 0) > 0 });
}
