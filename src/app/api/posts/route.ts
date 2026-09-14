import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { isWithinRateLimit } from "@/lib/rate-limit/check-rate-limit";
import { resolveTripId, TripTitleValidationError } from "@/lib/trips/resolve-trip";
import { validatePostInput } from "@/lib/posts/validate-post-input";
import { recordOperation } from "@/lib/logs/record-operation";
import { evaluatePostBadges } from "@/lib/badges/award-badges";
import { findBadgeDefinition } from "@/lib/badges/catalog";
import { parseMediaInput, toPostPhotoRows } from "@/lib/posts/media-input";
import {
  POST_RATE_LIMIT_MAX_ATTEMPTS,
  POST_RATE_LIMIT_WINDOW_SECONDS,
} from "@/lib/posts/constants";

interface PostRequestBody {
  tripTitle?: unknown;
  spotId?: unknown;
  category?: unknown;
  visitDate?: unknown;
  duration?: unknown;
  cost?: unknown;
  rating?: unknown;
  comment?: unknown;
  visibility?: unknown;
  photoPaths?: unknown;
  media?: unknown;
}

/**
 * F-PO-01 Task3・Task5: 投稿作成
 * F-BG Task2: 保存完了後のバッジ判定（レスポンスの newBadges をトースト表示に使う）
 * 出典: docs/tasks/posts/post-creation/03-post-creation-handler.md
 *       docs/tasks/posts/post-creation/05-post-creation-rate-limiting.md
 *       docs/tasks/badges/status-badges/02-post-count-prefecture-badge-evaluation.md
 *
 * 写真は先に POST /api/posts/photos、動画は POST /api/posts/videos で処理し、
 * その戻り値を media（旧形式は photoPaths）で受け取る。
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: PostRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Task5: 1ユーザーにつき1時間20件まで
  let allowed: boolean;
  try {
    allowed = await isWithinRateLimit(
      admin,
      user.id,
      "post_creation",
      POST_RATE_LIMIT_WINDOW_SECONDS,
      POST_RATE_LIMIT_MAX_ATTEMPTS
    );
  } catch {
    return NextResponse.json({ error: "rate_limit_unavailable" }, { status: 503 });
  }

  if (!allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  // --- 必須項目・入力規則の検証（編集APIと共通） ---
  const validation = validatePostInput(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const { category, duration, visibility, rating, cost, visitDate, comment } = validation.fields;

  // 写真・動画は1点以上必須（3.3.1）。他人のファイルのパスは紐づけさせない
  const mediaInput = parseMediaInput(body, user.id);
  if (!mediaInput.ok) {
    return NextResponse.json(
      { error: mediaInput.error === "media_required" ? "photo_required" : mediaInput.error },
      { status: 400 }
    );
  }
  const media = mediaInput.items;

  // スポットは登録済みのものだけを受け付ける（存在しないIDでの投稿を防ぐ）
  if (typeof body.spotId !== "string") {
    return NextResponse.json({ error: "spot_required" }, { status: 400 });
  }
  const { data: spot } = await admin
    .from("spots")
    .select("id, prefecture")
    .eq("id", body.spotId)
    .maybeSingle();
  if (!spot) {
    return NextResponse.json({ error: "spot_not_found" }, { status: 400 });
  }

  // 旅行タイトルはトリム後の完全一致で既存を探し、無ければ作成する（3.3.4）
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

  const { data: post, error: insertError } = await admin
    .from("posts")
    .insert({
      user_id: user.id,
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
    .select("id")
    .single();

  if (insertError || !post) {
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  const { error: photosError } = await admin
    .from("post_photos")
    .insert(toPostPhotoRows(post.id, media));

  if (photosError) {
    // 写真が1点も無い投稿は成立しないため、投稿ごと取り消す
    await admin.from("posts").delete().eq("id", post.id);
    return NextResponse.json({ error: "photo_insert_failed" }, { status: 500 });
  }

  // 要件7.5: 投稿の作成
  await recordOperation(admin, {
    actionType: "post_create",
    userId: user.id,
    targetId: post.id,
    detail: {
      visibility,
      photoCount: media.filter((item) => item.mediaType === "photo").length,
      videoCount: media.filter((item) => item.mediaType === "video").length,
    },
  });

  // F-BG Task2: 投稿数・都道府県バッジの判定。バッジ付与の失敗で投稿を失敗させない
  let newBadges: { type: string; label: string }[] = [];
  try {
    const awarded = await evaluatePostBadges(admin, user.id, spot.prefecture ?? null);
    newBadges = awarded.map((type) => ({
      type,
      label: findBadgeDefinition(type)?.label ?? type,
    }));
  } catch (error) {
    console.error("[badges] evaluatePostBadges failed", error);
  }

  return NextResponse.json({ postId: post.id, newBadges }, { status: 201 });
}
