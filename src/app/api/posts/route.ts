/**
 * POST /api/posts — 投稿を作成する Route Handler（サーバー側 API）
 *
 * 【初心者向け】Next.js では `app/api/.../route.ts` に置いた `POST` 関数がそのまま API になる。
 * ブラウザ（PostForm.tsx）が fetch で JSON を送り、ここで検証 → DB 保存 → 結果を JSON で返す。
 * 処理の順番: ①ログイン確認 → ②JSON の読み取り → ③レート制限 → ④入力検証 → ⑤旅行の確定 →
 *            ⑥（公開なら）スポットの確定 → ⑦posts に INSERT → ⑧写真・動画を post_photos に INSERT →
 *            ⑨（公開なら）ログ・バッジ・しおりの自動チェック → ⑩応答
 * DB へは `createAdminClient()`（service_role。RLS を通らない）で書くため、①の本人確認を必ず先に行う。
 *
 * v3.0（post-creation-v3 Task1 / draft Task1）:
 *   - `status: "draft"` なら必須項目が空でも保存できる。スポットは作らず、位置（lat/lng）だけを持つ。
 *     上限 20 件、レート制限は draft_save（1 時間 60 件）
 *   - 公開時は `spotId` が無ければ位置からスポットを確定する（50m 以内の既存に寄せる／新規登録）
 *   - 旅行タイトルが空なら仮タイトル「今日の投稿（M/D）」
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { isWithinRateLimit } from "@/lib/rate-limit/check-rate-limit";
import { RATE_LIMIT_ACTIONS } from "@/lib/rate-limit/actions";
import { resolveTripId, TripTitleValidationError } from "@/lib/trips/resolve-trip";
import { validatePostInput } from "@/lib/posts/validate-post-input";
import { parseMediaInput, toPostPhotoRows } from "@/lib/posts/media-input";
import { canCreateDraft, countDrafts } from "@/lib/posts/draft-limits";
import { afterPostPublished } from "@/lib/posts/publish-post";
import { finalizeSpotForPost } from "@/lib/spots/finalize-spot";
import {
  POST_RATE_LIMIT_MAX_ATTEMPTS,
  POST_RATE_LIMIT_WINDOW_SECONDS,
} from "@/lib/posts/constants";

/** ブラウザから届く JSON の形。値の型は信用せず `unknown` で受け、validatePostInput で確かめる */
interface PostRequestBody {
  status?: unknown;
  tripTitle?: unknown;
  spotId?: unknown;
  spotName?: unknown;
  category?: unknown;
  visitDate?: unknown;
  duration?: unknown;
  cost?: unknown;
  rating?: unknown;
  comment?: unknown;
  visibility?: unknown;
  lat?: unknown;
  lng?: unknown;
  photoPaths?: unknown;
  media?: unknown;
}

export async function POST(request: Request) {
  // ① Cookie のセッションからログイン中のユーザーを取り出す。無ければ 401（未ログイン）
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // ② リクエスト本文を JSON として読む。壊れた JSON は 400（クライアントの誤り）
  let body: PostRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const admin = createAdminClient();

  // ④ 必須項目・入力規則の検証（編集APIと共通）。status で公開／下書きが決まる
  const validation = validatePostInput(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const fields = validation.fields;
  const isDraft = fields.status === "draft";

  // ③ レート制限。公開は 1 時間 20 件、下書きは 1 時間 60 件（自動保存を含む）
  let allowed: boolean;
  try {
    allowed = isDraft
      ? await isWithinRateLimit(admin, user.id, RATE_LIMIT_ACTIONS.draftSave.actionType, RATE_LIMIT_ACTIONS.draftSave.windowSeconds, RATE_LIMIT_ACTIONS.draftSave.limit)
      : await isWithinRateLimit(admin, user.id, "post_creation", POST_RATE_LIMIT_WINDOW_SECONDS, POST_RATE_LIMIT_MAX_ATTEMPTS);
  } catch {
    return NextResponse.json({ error: "rate_limit_unavailable" }, { status: 503 });
  }
  if (!allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  // 下書きは 1 ユーザー 20 件まで
  if (isDraft) {
    try {
      if (!canCreateDraft(await countDrafts(admin, user.id))) {
        return NextResponse.json({ error: "draft_limit_reached" }, { status: 409 });
      }
    } catch {
      return NextResponse.json({ error: "draft_count_failed" }, { status: 500 });
    }
  }

  const media = parseMediaInput(body);
  if (!isDraft && media.length === 0) {
    return NextResponse.json({ error: "photo_required" }, { status: 400 });
  }

  // ⑤ 旅行タイトルはトリム後の完全一致で既存を探し、無ければ作成する（3.3.4）。空なら仮タイトル
  const tripTitle = typeof body.tripTitle === "string" ? body.tripTitle : "";
  let tripId: string;
  try {
    tripId = await resolveTripId(admin, user.id, tripTitle, { allowProvisional: true });
  } catch (error) {
    if (error instanceof TripTitleValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "trip_resolution_failed" }, { status: 500 });
  }

  // ⑥ スポット。公開なら必ず確定させる（既存 ID か、位置からの解決・新規登録）。下書きは選択済みの ID だけ保持
  let spotId: string | null = null;
  let prefecture: string | null = null;
  const requestedSpotId = typeof body.spotId === "string" && body.spotId.length > 0 ? body.spotId : null;
  if (!isDraft) {
    const finalized = await finalizeSpotForPost(
      admin,
      requestedSpotId
        ? { spotId: requestedSpotId }
        : { lat: fields.lat, lng: fields.lng, name: typeof body.spotName === "string" ? body.spotName : null }
    );
    if (!finalized.ok) {
      const status = finalized.error === "nearby_lookup_failed" ? 503 : finalized.error === "insert_failed" ? 500 : 400;
      return NextResponse.json({ error: finalized.error }, { status });
    }
    spotId = finalized.spot.id;
    prefecture = finalized.spot.prefecture;
  } else if (requestedSpotId) {
    const { data: spot } = await admin.from("spots").select("id").eq("id", requestedSpotId).maybeSingle();
    spotId = spot?.id ?? null;
  }

  // ⑦ 投稿本体を保存。`.select("id").single()` で作成された行の id だけを受け取る
  const now = new Date().toISOString();
  const { data: post, error: insertError } = await admin
    .from("posts")
    .insert({
      user_id: user.id,
      trip_id: tripId,
      spot_id: spotId,
      status: fields.status,
      category: fields.category,
      visit_date: fields.visitDate,
      duration: fields.duration,
      cost: fields.cost,
      rating: fields.rating,
      comment: fields.comment,
      visibility: fields.visibility,
      lat: fields.lat,
      lng: fields.lng,
      published_at: isDraft ? null : now,
    })
    .select("id")
    .single();

  if (insertError || !post) {
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  // ⑧ 写真・動画は別テーブル（1 投稿に複数）。display_order が並び順で、0 番目が代表
  if (media.length > 0) {
    const { error: photosError } = await admin.from("post_photos").insert(toPostPhotoRows(post.id, media));
    if (photosError) {
      // 写真が1点も無い公開投稿は成立しないため、投稿ごと取り消す（下書きは写真無しでも成立するが、同じ扱いで安全側に倒す）
      await admin.from("posts").delete().eq("id", post.id);
      return NextResponse.json({ error: "photo_insert_failed" }, { status: 500 });
    }
  }

  // ⑨ 公開時だけ：操作ログ・バッジ判定・しおりの自動チェック（失敗しても投稿は成功させる）
  let newBadges: { type: string; label: string }[] = [];
  if (!isDraft && spotId) {
    newBadges = await afterPostPublished(admin, {
      postId: post.id,
      userId: user.id,
      tripId,
      spotId,
      prefecture,
      visibility: fields.visibility,
      mediaCount: media.length,
      fromDraft: false,
    });
  }

  return NextResponse.json({ postId: post.id, status: fields.status, newBadges }, { status: 201 });
}
