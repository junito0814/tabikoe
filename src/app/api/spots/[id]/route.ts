import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { updateOwnSpot, validateSpotFixInput } from "@/lib/moderation/spot-fix";

/**
 * strike-system Task 6: PATCH /api/spots/[id]（登録者が自分の「タビコエだけの場所」を直す）
 * 出典: docs/tasks/safety/strike-system/06-spot-fix-request.md
 *
 * body: { name, prefecture, lat, lng }。本人が登録した source = 'manual' のスポットだけ。他人・Google 由来は 403。
 * 直したら、そのスポットへの「スポット情報の誤り」の未処理の通報は「問題なし」になる。
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const validation = validateSpotFixInput(body);
  if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });

  try {
    const result = await updateOwnSpot(createAdminClient(), { userId: user.id, spotId: id, fields: validation.fields });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.error === "not_found" ? 404 : 403 });
    return NextResponse.json({ ok: true, resolvedReports: result.resolvedReports });
  } catch {
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
}
