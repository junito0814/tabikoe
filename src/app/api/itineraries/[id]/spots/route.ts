import { NextResponse } from "next/server";
import { authorizeItinerary, isErrorResponse, readJson } from "@/lib/itineraries/route-helpers";
import { clampDayIndex, dayCount } from "@/lib/itineraries/day-utils";

/**
 * add-spots Task1: しおりへのスポット追加
 * 出典: docs/tasks/itinerary/add-spots/01-add-remove-spot-api.md
 *       要件定義書 v3.0 3.11.4
 *
 * POST /api/itineraries/[id]/spots { spotId, dayIndex? }  メンバーのみ
 *   同じスポットが既に入っていれば 200 で既存の行を返す（冪等）。sort_order は末尾。
 *   dayIndex が期間の外なら未定（null）に丸める。
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await authorizeItinerary(id, "add_spot");
  if (isErrorResponse(context)) return context;

  const body = await readJson<{ spotId?: unknown; dayIndex?: unknown }>(request);
  const spotId = typeof body?.spotId === "string" ? body.spotId : "";
  if (!spotId) {
    return NextResponse.json({ error: "spot_id_required" }, { status: 400 });
  }
  const requestedDay = body?.dayIndex === null || body?.dayIndex === undefined ? null : Number(body.dayIndex);
  if (requestedDay !== null && (!Number.isInteger(requestedDay) || requestedDay < 1)) {
    return NextResponse.json({ error: "invalid_day_index" }, { status: 400 });
  }

  const { admin } = context;
  const [{ data: spot }, { data: itinerary }, { data: existing }] = await Promise.all([
    admin.from("spots").select("id, hidden_at").eq("id", spotId).maybeSingle(),
    admin.from("itineraries").select("start_date, end_date").eq("id", id).maybeSingle(),
    admin.from("itinerary_spots").select("id, spot_id, day_index, sort_order").eq("itinerary_id", id).eq("spot_id", spotId).maybeSingle(),
  ]);
  if (!spot || spot.hidden_at) {
    return NextResponse.json({ error: "spot_not_found" }, { status: 404 });
  }
  if (!itinerary) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (existing) {
    return NextResponse.json({ itinerarySpot: existing, alreadyAdded: true });
  }

  const dayIndex = clampDayIndex(requestedDay, dayCount(itinerary.start_date, itinerary.end_date));
  const { data: last } = await admin
    .from("itinerary_spots")
    .select("sort_order")
    .eq("itinerary_id", id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sortOrder = (last?.sort_order ?? -1) + 1;

  const { data: created, error } = await admin
    .from("itinerary_spots")
    .insert({ itinerary_id: id, spot_id: spotId, day_index: dayIndex, sort_order: sortOrder })
    .select("id, spot_id, day_index, sort_order")
    .single();
  if (error || !created) {
    if (error?.code === "23505") {
      // 同時追加。既存を返す（冪等）
      const { data: raced } = await admin.from("itinerary_spots").select("id, spot_id, day_index, sort_order").eq("itinerary_id", id).eq("spot_id", spotId).maybeSingle();
      if (raced) return NextResponse.json({ itinerarySpot: raced, alreadyAdded: true });
    }
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }
  return NextResponse.json({ itinerarySpot: created, alreadyAdded: false }, { status: 201 });
}
