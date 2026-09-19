import { NextResponse } from "next/server";
import { clampDayIndex, dayCount, validatePeriod } from "@/lib/itineraries/day-utils";
import { getItinerary } from "@/lib/itineraries/get-itinerary";
import { authorizeItinerary, isErrorResponse, readJson } from "@/lib/itineraries/route-helpers";
import { assertValidTripTitle, normalizeTripTitle, TripTitleValidationError } from "@/lib/trips/resolve-trip";

/**
 * itinerary-basics Task1 / itinerary-days Task1: しおりの詳細・更新・削除
 * 出典: docs/tasks/itinerary/itinerary-basics/01-itinerary-crud-api.md
 *       docs/tasks/itinerary/itinerary-days/01-period-update-and-day-recalc.md
 *
 * GET    /api/itineraries/[id]                 メンバーのみ（非メンバーは 404）
 * PATCH  /api/itineraries/[id] { startDate, endDate } | { title }   オーナーのみ
 *   期間を縮めて範囲外になった Day のスポットは未定（day_index = NULL）へ。期間解除は全部未定
 * DELETE /api/itineraries/[id]                 オーナーのみ。trips（アルバム）と posts は残る
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await authorizeItinerary(id, "view");
  if (isErrorResponse(context)) return context;
  try {
    const itinerary = await getItinerary(context.admin, id, context.userId);
    if (!itinerary) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ itinerary });
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await readJson<{ startDate?: unknown; endDate?: unknown; title?: unknown }>(request);
  if (!body) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (typeof body.title === "string") {
    const context = await authorizeItinerary(id, "rename");
    if (isErrorResponse(context)) return context;
    const title = normalizeTripTitle(body.title);
    try {
      assertValidTripTitle(title);
    } catch (error) {
      return NextResponse.json({ error: error instanceof TripTitleValidationError ? error.message : "invalid_title" }, { status: 400 });
    }
    const { data: itinerary } = await context.admin.from("itineraries").select("trip_id").eq("id", id).maybeSingle();
    if (!itinerary) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const { error } = await context.admin.from("trips").update({ title }).eq("id", itinerary.trip_id);
    if (error) {
      return NextResponse.json({ error: error.code === "23505" ? "trip_title_duplicate" : "update_failed" }, { status: error.code === "23505" ? 409 : 500 });
    }
    return NextResponse.json({ ok: true, title });
  }

  const context = await authorizeItinerary(id, "change_period");
  if (isErrorResponse(context)) return context;
  const period = validatePeriod(body.startDate, body.endDate);
  if (!period.ok) {
    return NextResponse.json({ error: period.error }, { status: 400 });
  }
  const { error } = await context.admin.from("itineraries").update({ start_date: period.startDate, end_date: period.endDate }).eq("id", id);
  if (error) {
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  // 範囲外になった Day のスポットを日付なしへ（消さない）
  const count = dayCount(period.startDate, period.endDate);
  const { data: spots } = await context.admin.from("itinerary_spots").select("id, day_index").eq("itinerary_id", id).not("day_index", "is", null);
  const outOfRange = ((spots ?? []) as { id: string; day_index: number | null }[]).filter((row) => clampDayIndex(row.day_index, count) === null);
  if (outOfRange.length > 0) {
    await context.admin
      .from("itinerary_spots")
      .update({ day_index: null })
      .in(
        "id",
        outOfRange.map((row) => row.id)
      );
  }
  return NextResponse.json({ ok: true, startDate: period.startDate, endDate: period.endDate, dayCount: count, movedToUndecided: outOfRange.length });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await authorizeItinerary(id, "delete");
  if (isErrorResponse(context)) return context;
  // itinerary_spots / members / invitations は on delete cascade。trips と posts には触れない
  const { error } = await context.admin.from("itineraries").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
