import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { can, getItineraryRole, type ItineraryAction, type ItineraryRole } from "./membership";

/**
 * しおり API 共通: 「ログイン → メンバーか（404）→ その操作ができる役割か（403）」
 * 出典: docs/tasks/itinerary/itinerary-sharing/03-permissions-and-ownership.md
 *
 * 【初心者向け】しおりの Route Handler は全部この順で始まるので、1 つの関数にまとめた。
 * 戻り値が `NextResponse` ならそのまま返す（エラー）。そうでなければ admin・user・role が揃っている。
 * 404 と 403 を分けるのは、メンバー以外にはしおりの存在自体を教えないため。
 */
export type ItineraryContext = { admin: SupabaseClient; userId: string; role: ItineraryRole };

export async function authorizeItinerary(itineraryId: string, action: ItineraryAction): Promise<ItineraryContext | NextResponse> {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  let role: ItineraryRole | null;
  try {
    role = await getItineraryRole(admin, itineraryId, user.id);
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
  if (!role) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!can(role, action)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return { admin, userId: user.id, role };
}

export function isErrorResponse(value: ItineraryContext | NextResponse): value is NextResponse {
  return value instanceof NextResponse;
}

export async function readJson<T extends object>(request: Request): Promise<T | null> {
  try {
    const body = (await request.json()) as T;
    return body && typeof body === "object" ? body : null;
  } catch {
    return null;
  }
}
