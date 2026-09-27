import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAdminAction } from "@/lib/admin/admin-actions";
import { createNotification } from "@/lib/notifications/create-notification";
import { PREFECTURES } from "@/lib/geo/prefectures";

/**
 * strike-system Task 6: スポット情報の誤りは登録者に修正を依頼する（SC-29）
 * 出典: docs/tasks/safety/strike-system/06-spot-fix-request.md
 *       要件定義書 3.10.6「スポット情報の誤り」・3.10.13
 *
 * 【初心者向け】管理者が全部直すのは回らないので、直せる人（登録者）に返す。
 *   - 依頼できるのは「タビコエだけの場所」（spots.source = 'manual'）で登録者（created_by）が居るときだけ。
 *     Google 由来のスポットは Google のデータなのでこちらでは直せない
 *   - 依頼は通報を「確認中」にし、登録者に通知（spot_fix_request）。ストライクは付けない
 *   - 登録者が直す（PATCH /api/spots/[id]）と、そのスポットへの「スポット情報の誤り」の未処理の通報は自動で「問題なし」になる
 */
export interface SpotFixTarget {
  id: string;
  name: string;
  prefecture: string | null;
  lat: number;
  lng: number;
  source: string;
  createdBy: string | null;
}

/** 修正を依頼できるか（純粋関数） */
export function canRequestSpotFix(report: { targetType: string; reason: string }, spot: { source: string; createdBy: string | null } | null): boolean {
  return report.targetType === "spot" && report.reason === "wrong_spot_info" && !!spot && spot.source === "manual" && !!spot.createdBy;
}

export async function loadSpotFixTarget(admin: SupabaseClient, spotId: string): Promise<SpotFixTarget | null> {
  const { data, error } = await admin.from("spots").select("id, name, prefecture, lat, lng, source, created_by").eq("id", spotId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id as string,
    name: data.name as string,
    prefecture: (data.prefecture as string | null) ?? null,
    lat: data.lat as number,
    lng: data.lng as number,
    source: data.source as string,
    createdBy: (data.created_by as string | null) ?? null,
  };
}

/** 管理者が依頼する */
export async function requestSpotFix(
  admin: SupabaseClient,
  input: { adminId: string; reportId: string; note: string; now?: Date }
): Promise<{ ok: true } | { ok: false; error: "not_found" | "not_applicable" }> {
  const { data: report, error } = await admin.from("reports").select("id, target_type, target_id, reason, status").eq("id", input.reportId).maybeSingle();
  if (error) throw error;
  if (!report) return { ok: false, error: "not_found" };
  const spot = await loadSpotFixTarget(admin, report.target_id as string);
  if (!canRequestSpotFix({ targetType: report.target_type as string, reason: report.reason as string }, spot) || !spot?.createdBy) {
    return { ok: false, error: "not_applicable" };
  }

  const { error: updateError } = await admin.from("reports").update({ status: "in_review" }).eq("id", input.reportId).in("status", ["unconfirmed", "in_review"]);
  if (updateError) throw updateError;

  // 依頼の内容（メモ）は操作の記録に残し、通知一覧はそこから引く（recordAdminAction の後に通知を作る）
  await recordAdminAction(admin, {
    actorId: input.adminId,
    action: "spot_fix_request",
    target: { type: "spot", id: spot.id, label: `スポット「${spot.name}」` },
    note: input.note,
  });
  await createNotification(admin, { recipientId: spot.createdBy, actorId: null, type: "spot_fix_request", relatedId: spot.id });
  return { ok: true };
}

export const MAX_SPOT_NAME_LENGTH = 100;
const PREFECTURE_NAMES = new Set(PREFECTURES.map((p) => p.name));

export interface SpotFixInput {
  name: string;
  prefecture: string | null;
  lat: number;
  lng: number;
}

/** 登録者の修正の入力規則（純粋関数） */
export function validateSpotFixInput(body: unknown): { ok: true; fields: SpotFixInput } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) return { ok: false, error: "invalid_body" };
  const b = body as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name) return { ok: false, error: "name_required" };
  if ([...name].length > MAX_SPOT_NAME_LENGTH) return { ok: false, error: "name_too_long" };
  const prefecture = b.prefecture === null || b.prefecture === "" || b.prefecture === undefined ? null : b.prefecture;
  if (prefecture !== null && (typeof prefecture !== "string" || !PREFECTURE_NAMES.has(prefecture))) return { ok: false, error: "invalid_prefecture" };
  const lat = b.lat;
  const lng = b.lng;
  if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { ok: false, error: "invalid_position" };
  }
  return { ok: true, fields: { name, prefecture, lat, lng } };
}

/** 登録者が自分の「タビコエだけの場所」を直す。直したら、そのスポットへの「情報の誤り」の未処理の通報を「問題なし」に */
export async function updateOwnSpot(
  admin: SupabaseClient,
  input: { userId: string; spotId: string; fields: SpotFixInput; now?: Date }
): Promise<{ ok: true; resolvedReports: number } | { ok: false; error: "not_found" | "forbidden" }> {
  const now = input.now ?? new Date();
  const spot = await loadSpotFixTarget(admin, input.spotId);
  if (!spot) return { ok: false, error: "not_found" };
  if (spot.source !== "manual" || spot.createdBy !== input.userId) return { ok: false, error: "forbidden" };

  const { error } = await admin
    .from("spots")
    .update({ name: input.fields.name, prefecture: input.fields.prefecture, lat: input.fields.lat, lng: input.fields.lng })
    .eq("id", input.spotId);
  if (error) throw error;

  const { data: resolved, error: reportError } = await admin
    .from("reports")
    .update({ status: "no_issue", resolved_at: now.toISOString(), resolution_note: "登録者が修正" })
    .eq("target_type", "spot")
    .eq("target_id", input.spotId)
    .eq("reason", "wrong_spot_info")
    .in("status", ["unconfirmed", "in_review"])
    .select("id");
  if (reportError) throw reportError;
  return { ok: true, resolvedReports: resolved?.length ?? 0 };
}
