import { NextResponse } from "next/server";
import { graphemeLength } from "@/lib/text/grapheme-length";
import { clampDayIndex, dayCount } from "@/lib/itineraries/day-utils";
import { isTenMinuteTime } from "@/lib/itineraries/order-spots";
import { authorizeItinerary, isErrorResponse, readJson, type ItineraryContext } from "@/lib/itineraries/route-helpers";

/** メモの上限（書記素）。要件定義書 v3.0 3.11.3 */
const MAX_ITINERARY_MEMO_LENGTH = 500;

/**
 * itinerary-days Task1 / arrival-time Task1 / itinerary-check Task1 / add-spots Task1: しおりのスポット 1 行の更新・削除
 * 出典: docs/tasks/itinerary/itinerary-days/01-period-update-and-day-recalc.md
 *       docs/tasks/itinerary/arrival-time/01-spot-update-api-and-ordering.md
 *       docs/tasks/itinerary/itinerary-check/01-check-api.md
 *       docs/tasks/itinerary/add-spots/01-add-remove-spot-api.md
 *
 * PATCH /api/itineraries/[id]/spots/[spotId]（spotId は spots.id）
 *   { dayIndex }     Day の移動（時刻があれば時刻順、無ければ末尾の sort_order）
 *   { arrivalTime }  10 分刻み（"HH:MM"）または null
 *   { memo }         500 文字（書記素）または null
 *   { sortOrder }    手動順（時刻の無い行）
 *   { checked }      true → checked_at/checked_by を設定、false → 解除。通知は作らない
 *   複数まとめて送ってもよい。すべてメンバーが操作できる
 * DELETE  しおりから外す（posts・wishlist は不変）
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; spotId: string }> }) {
  const { id, spotId } = await params;
  const body = await readJson<{ dayIndex?: unknown; arrivalTime?: unknown; memo?: unknown; sortOrder?: unknown; checked?: unknown }>(request);
  if (!body) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  // どの操作にも同じ役割（member 以上）で足りるが、権限表に沿って代表の操作名で判定する
  const context = await authorizeItinerary(id, "move_day");
  if (isErrorResponse(context)) return context;
  const { admin, userId } = context;

  const { data: row } = await admin.from("itinerary_spots").select("id, day_index, arrival_time, sort_order").eq("itinerary_id", id).eq("spot_id", spotId).maybeSingle();
  if (!row) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const update: Record<string, unknown> = {};

  if ("arrivalTime" in body) {
    if (body.arrivalTime !== null && !isTenMinuteTime(body.arrivalTime)) {
      return NextResponse.json({ error: "invalid_arrival_time" }, { status: 400 });
    }
    update.arrival_time = body.arrivalTime === null ? null : `${(body.arrivalTime as string).slice(0, 5)}:00`;
  }
  if ("memo" in body) {
    if (body.memo !== null && typeof body.memo !== "string") {
      return NextResponse.json({ error: "invalid_memo" }, { status: 400 });
    }
    const memo = typeof body.memo === "string" ? body.memo.trim() : null;
    if (memo && graphemeLength(memo) > MAX_ITINERARY_MEMO_LENGTH) {
      return NextResponse.json({ error: "memo_too_long" }, { status: 400 });
    }
    update.memo = memo && memo.length > 0 ? memo : null;
  }
  if ("sortOrder" in body) {
    if (!Number.isInteger(body.sortOrder) || (body.sortOrder as number) < 0) {
      return NextResponse.json({ error: "invalid_sort_order" }, { status: 400 });
    }
    update.sort_order = body.sortOrder;
  }
  if ("checked" in body) {
    if (typeof body.checked !== "boolean") {
      return NextResponse.json({ error: "invalid_checked" }, { status: 400 });
    }
    update.checked_at = body.checked ? new Date().toISOString() : null;
    update.checked_by = body.checked ? userId : null;
  }
  if ("dayIndex" in body) {
    const requested = body.dayIndex === null ? null : Number(body.dayIndex);
    if (requested !== null && (!Number.isInteger(requested) || requested < 1)) {
      return NextResponse.json({ error: "invalid_day_index" }, { status: 400 });
    }
    const { data: itinerary } = await admin.from("itineraries").select("start_date, end_date").eq("id", id).maybeSingle();
    const dayIndex = clampDayIndex(requested, dayCount(itinerary?.start_date ?? null, itinerary?.end_date ?? null));
    if (requested !== null && dayIndex === null) {
      return NextResponse.json({ error: "day_out_of_range" }, { status: 400 });
    }
    update.day_index = dayIndex;
    // 移動先では末尾の手動順にする（時刻があれば時刻順で並ぶので sort_order は影響しない）
    if (!("sortOrder" in body)) {
      update.sort_order = await nextSortOrder(context, id);
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "nothing_to_update" }, { status: 400 });
  }

  const { data: updated, error } = await admin
    .from("itinerary_spots")
    .update(update)
    .eq("id", row.id)
    .select("id, spot_id, day_index, arrival_time, sort_order, memo, checked_at, checked_by")
    .single();
  if (error || !updated) {
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
  return NextResponse.json({ itinerarySpot: updated });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; spotId: string }> }) {
  const { id, spotId } = await params;
  const context = await authorizeItinerary(id, "remove_spot");
  if (isErrorResponse(context)) return context;
  const { error } = await context.admin.from("itinerary_spots").delete().eq("itinerary_id", id).eq("spot_id", spotId);
  if (error) {
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

async function nextSortOrder(context: ItineraryContext, itineraryId: string): Promise<number> {
  const { data: last } = await context.admin
    .from("itinerary_spots")
    .select("sort_order")
    .eq("itinerary_id", itineraryId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (last?.sort_order ?? -1) + 1;
}
