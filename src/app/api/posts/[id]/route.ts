import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { resolveTripId, TripTitleValidationError } from "@/lib/trips/resolve-trip";
import { validatePostInput } from "@/lib/posts/validate-post-input";

/**
 * F-PO-02 Task1: 投稿編集
 * 出典: docs/tasks/posts/post-edit/01-post-edit-handler.md
 *
 * 投稿者本人のみ編集できる。共同アルバムのオーナーであっても他人の投稿は編集不可（3.3.3）。
 * `created_at`（新着順の基準）は更新対象に含めないため、編集しても投稿日時は変わらない。
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: existing, error: fetchError } = await admin
    .from("posts")
    .select("id, user_id")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  // 他人の投稿は、存在自体を伏せる必要はないため403で明示的に拒否する
  if (existing.user_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const validation = validatePostInput(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const { category, duration, visibility, rating, cost, visitDate, comment } = validation.fields;

  if (typeof body.spotId !== "string") {
    return NextResponse.json({ error: "spot_required" }, { status: 400 });
  }
  const { data: spot } = await admin
    .from("spots")
    .select("id")
    .eq("id", body.spotId)
    .maybeSingle();
  if (!spot) {
    return NextResponse.json({ error: "spot_not_found" }, { status: 400 });
  }

  if (typeof body.tripTitle !== "string") {
    return NextResponse.json({ error: "trip_title_required" }, { status: 400 });
  }
  let tripId: string;
  try {
    tripId = await resolveTripId(admin, user.id, body.tripTitle);
  } catch (error) {
    if (error instanceof TripTitleValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "trip_resolution_failed" }, { status: 500 });
  }

  // created_atは含めない（3.3.3「編集しても投稿日時は更新しない」）
  const { error: updateError } = await admin
    .from("posts")
    .update({
      trip_id: tripId,
      spot_id: spot.id,
      category,
      visit_date: visitDate,
      duration,
      cost,
      rating,
      comment,
      visibility,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (updateError) {
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ postId: id });
}
