import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { RATE_LIMIT_ACTIONS } from "@/lib/rate-limit/actions";
import { isWithinRateLimit } from "@/lib/rate-limit/check-rate-limit";
import { getSpotStatus, parseSpotStatus, upsertSpotStatusReport } from "@/lib/spots/status-report";

/**
 * spot-status-report Task1: 報告 API
 * 出典: docs/tasks/browsing/spot-status-report/01-report-api.md
 *
 * PUT /api/spots/[id]/status  body: { status: "still_there" | "gone" }  → UPSERT（1 人 1 件）。1 日 50 件のレート制限
 * GET /api/spots/[id]/status  → { latest, mine }
 * 通知は作らない（3.5.5）。
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await getSpotStatus(createAdminClient(), id, user.id));
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { status?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const status = parseSpotStatus(body.status);
  if (!status) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: spot } = await admin.from("spots").select("id, hidden_at").eq("id", id).maybeSingle();
  if (!spot || spot.hidden_at) {
    return NextResponse.json({ error: "spot_not_found" }, { status: 404 });
  }

  const limit = RATE_LIMIT_ACTIONS.spotStatusReport;
  let allowed: boolean;
  try {
    allowed = await isWithinRateLimit(admin, user.id, limit.actionType, limit.windowSeconds, limit.limit);
  } catch {
    return NextResponse.json({ error: "rate_limit_unavailable" }, { status: 503 });
  }
  if (!allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  try {
    // 操作ログ（7.5）の対象ではない（評価ではなく鮮度の報告。action_type の制約にも含めない）
    const summary = await upsertSpotStatusReport(admin, id, user.id, status);
    return NextResponse.json(summary);
  } catch {
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
}
