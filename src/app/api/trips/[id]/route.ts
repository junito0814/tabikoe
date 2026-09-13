import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { getAlbumDetail } from "@/lib/albums/get-album";
import {
  TripTitleValidationError,
  assertValidTripTitle,
  normalizeTripTitle,
} from "@/lib/trips/resolve-trip";

/**
 * F-RC-02 Task1: アルバム詳細（投稿・写真・動画・メンバー）
 * 出典: docs/tasks/records/album/01-album-detail-handler.md
 *
 * 当該旅行の album_members に居るユーザー（オーナー・編集者・閲覧者）のみ取得できる。
 * メンバーには公開・非公開を問わず全投稿を返す（3.6.3）。メンバーでなければ404。
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const album = await getAlbumDetail(createAdminClient(), user.id, id);
    if (!album) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ album });
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
}

/**
 * F-PO-01 旅行タイトル Task3: 旅行タイトル編集（アルバム名変更）
 * 出典: docs/tasks/posts/trip-title/03-trip-title-rename-handler.md
 *
 * 投稿側はtrips.titleを参照するだけの設計のため、ここを更新すれば
 * その旅行IDに紐づく全投稿の表示名に自動的に反映される。
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

  let rawTitle: unknown;
  try {
    const body = await request.json();
    rawTitle = body?.title;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (typeof rawTitle !== "string") {
    return NextResponse.json({ error: "trip_title_required" }, { status: 400 });
  }

  const title = normalizeTripTitle(rawTitle);
  try {
    assertValidTripTitle(title);
  } catch (error) {
    if (error instanceof TripTitleValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  // オーナー（作成者）のみ変更可能。user_id条件とRLSの二重で担保する
  const { data, error } = await supabase
    .from("trips")
    .update({ title })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, title")
    .maybeSingle();

  if (error) {
    // 同一ユーザー内で同名の旅行が既にある場合は一意制約に弾かれる
    return NextResponse.json({ error: "update_failed" }, { status: 400 });
  }

  if (!data) {
    // 存在しない、または本人がオーナーでない
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ trip: data });
}
