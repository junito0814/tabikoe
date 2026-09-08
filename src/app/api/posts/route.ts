import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { graphemeLength } from "@/lib/text/grapheme-length";
import { isWithinRateLimit } from "@/lib/rate-limit/check-rate-limit";
import { resolveTripId, TripTitleValidationError } from "@/lib/trips/resolve-trip";
import {
  MAX_POST_COMMENT_LENGTH,
  MAX_POST_COST,
  MAX_POST_RATING,
  MIN_POST_COST,
  MIN_POST_RATING,
  POST_CATEGORIES,
  POST_DURATIONS,
  POST_RATE_LIMIT_MAX_ATTEMPTS,
  POST_RATE_LIMIT_WINDOW_SECONDS,
  POST_VISIBILITIES,
  todayInJst,
  type PostCategory,
  type PostDuration,
  type PostVisibility,
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
}

/**
 * F-PO-01 Task3・Task5: 投稿作成
 * 出典: docs/tasks/posts/post-creation/03-post-creation-handler.md
 *       docs/tasks/posts/post-creation/05-post-creation-rate-limiting.md
 *
 * 写真は先に POST /api/posts/photos でアップロードし、そのパスをphotoPathsで受け取る。
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

  // --- 必須項目・入力規則の検証 ---
  const { category, duration, visibility } = body;

  if (typeof category !== "string" || !POST_CATEGORIES.includes(category as PostCategory)) {
    return NextResponse.json({ error: "invalid_category" }, { status: 400 });
  }
  if (typeof duration !== "string" || !POST_DURATIONS.includes(duration as PostDuration)) {
    return NextResponse.json({ error: "invalid_duration" }, { status: 400 });
  }
  if (
    typeof visibility !== "string" ||
    !POST_VISIBILITIES.includes(visibility as PostVisibility)
  ) {
    return NextResponse.json({ error: "invalid_visibility" }, { status: 400 });
  }

  const rating = body.rating;
  if (
    typeof rating !== "number" ||
    !Number.isInteger(rating) ||
    rating < MIN_POST_RATING ||
    rating > MAX_POST_RATING
  ) {
    return NextResponse.json({ error: "invalid_rating" }, { status: 400 });
  }

  // 費用は任意。未入力はnullとして扱う
  let cost: number | null = null;
  if (body.cost !== null && body.cost !== undefined && body.cost !== "") {
    if (
      typeof body.cost !== "number" ||
      !Number.isInteger(body.cost) ||
      body.cost < MIN_POST_COST ||
      body.cost > MAX_POST_COST
    ) {
      return NextResponse.json({ error: "invalid_cost" }, { status: 400 });
    }
    cost = body.cost;
  }

  // 訪問日は任意。指定された場合はJST基準で未来日を認めない
  let visitDate: string | null = null;
  if (typeof body.visitDate === "string" && body.visitDate.length > 0) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.visitDate)) {
      return NextResponse.json({ error: "invalid_visit_date" }, { status: 400 });
    }
    if (body.visitDate > todayInJst()) {
      return NextResponse.json({ error: "future_visit_date" }, { status: 400 });
    }
    visitDate = body.visitDate;
  }

  const comment = typeof body.comment === "string" ? body.comment : "";
  if (graphemeLength(comment) > MAX_POST_COMMENT_LENGTH) {
    return NextResponse.json({ error: "comment_too_long" }, { status: 400 });
  }

  const photoPaths = Array.isArray(body.photoPaths)
    ? body.photoPaths.filter((path): path is string => typeof path === "string")
    : [];
  if (photoPaths.length === 0) {
    return NextResponse.json({ error: "photo_required" }, { status: 400 });
  }

  // スポットは登録済みのものだけを受け付ける（存在しないIDでの投稿を防ぐ）
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
      comment: comment.length > 0 ? comment : null,
      visibility,
    })
    .select("id")
    .single();

  if (insertError || !post) {
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  const { error: photosError } = await admin.from("post_photos").insert(
    photoPaths.map((storagePath, index) => ({
      post_id: post.id,
      media_type: "photo",
      storage_url: storagePath,
      display_order: index,
    }))
  );

  if (photosError) {
    // 写真が1点も無い投稿は成立しないため、投稿ごと取り消す
    await admin.from("posts").delete().eq("id", post.id);
    return NextResponse.json({ error: "photo_insert_failed" }, { status: 500 });
  }

  return NextResponse.json({ postId: post.id }, { status: 201 });
}
