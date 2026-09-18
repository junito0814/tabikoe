import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { validatePeriod } from "@/lib/itineraries/day-utils";
import { listItineraries } from "@/lib/itineraries/get-itinerary";
import { readJson } from "@/lib/itineraries/route-helpers";
import { resolveTripId, TripTitleValidationError } from "@/lib/trips/resolve-trip";

/**
 * itinerary-basics Task1: しおりの一覧・作成
 * 出典: docs/tasks/itinerary/itinerary-basics/01-itinerary-crud-api.md
 *       要件定義書 v3.0 3.11.1
 *
 * GET  /api/itineraries?spot=<id>  自分がオーナーまたはメンバーのしおり（spot 指定で「入っているか」フラグ付き）
 * POST /api/itineraries { title, startDate?, endDate? }
 *   旅行は resolve-trip.ts で解決する（同名の自分の旅行があればそれ、無ければ新規＝同名のアルバムとつながる）。
 *   旅行のオーナーでなければ 403、既にしおりがあれば 409。作成者は DB のトリガーで owner として itinerary_members に入る。
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const spotId = new URL(request.url).searchParams.get("spot");
  try {
    const items = await listItineraries(createAdminClient(), user.id, { spotId });
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await readJson<{ title?: unknown; startDate?: unknown; endDate?: unknown }>(request);
  if (!body) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const period = validatePeriod(body.startDate, body.endDate);
  if (!period.ok) {
    return NextResponse.json({ error: period.error }, { status: 400 });
  }

  const admin = createAdminClient();
  let tripId: string;
  try {
    tripId = await resolveTripId(admin, user.id, typeof body.title === "string" ? body.title : "");
  } catch (error) {
    if (error instanceof TripTitleValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "trip_resolve_failed" }, { status: 500 });
  }

  // 旅行のオーナーだけがしおりを作れる（共同アルバムの編集者は不可。3.11.1）
  const { data: trip } = await admin.from("trips").select("user_id").eq("id", tripId).maybeSingle();
  if (!trip || trip.user_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { data: existing } = await admin.from("itineraries").select("id").eq("trip_id", tripId).maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "itinerary_exists", itineraryId: existing.id }, { status: 409 });
  }

  const { data: created, error } = await admin
    .from("itineraries")
    .insert({ trip_id: tripId, start_date: period.startDate, end_date: period.endDate })
    .select("id")
    .single();
  if (error || !created) {
    // 同時作成で一意制約に当たった場合は既存を返す
    if (error?.code === "23505") {
      const { data: raced } = await admin.from("itineraries").select("id").eq("trip_id", tripId).maybeSingle();
      if (raced) return NextResponse.json({ error: "itinerary_exists", itineraryId: raced.id }, { status: 409 });
    }
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }
  return NextResponse.json({ itineraryId: created.id, tripId }, { status: 201 });
}
