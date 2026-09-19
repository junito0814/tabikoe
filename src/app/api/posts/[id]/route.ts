import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { resolveTripId, TripTitleValidationError } from "@/lib/trips/resolve-trip";
import { validatePostInput } from "@/lib/posts/validate-post-input";
import { finalizeSpotForPost } from "@/lib/spots/finalize-spot";
import { afterPostPublished } from "@/lib/posts/publish-post";
import { isWithinRateLimit } from "@/lib/rate-limit/check-rate-limit";
import { RATE_LIMIT_ACTIONS } from "@/lib/rate-limit/actions";
import { removeStorageObjects } from "@/lib/posts/photos";
import { recordOperation } from "@/lib/logs/record-operation";
import { getPostDetail } from "@/lib/posts/post-detail";
import { evaluatePostBadges } from "@/lib/badges/award-badges";
import { findBadgeDefinition } from "@/lib/badges/catalog";

/**
 * F-VW-01 Task1: 投稿詳細取得・非公開アクセス制御
 * 出典: docs/tasks/browsing/post-detail-view/01-post-detail-handler.md
 *
 * 非公開投稿は投稿者本人・アルバムメンバー以外には404（存在しない扱い）。
 * ブロック関係のユーザーの投稿も同様に404。退会済みユーザーの投稿者名は匿名化して返す。
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const post = await getPostDetail(createAdminClient(), user.id, id);
    if (!post) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ post });
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
}

/**
 * F-PO-02 Task1 / post-edit-v3 Task1 / draft Task1・Task3: 投稿の編集・下書きの更新・下書きの公開
 * 出典: docs/tasks/posts/post-edit/01-post-edit-handler.md
 *       docs/tasks/posts/post-edit-v3/01-edit-location.md
 *       docs/tasks/posts/draft/01-draft-save-api.md
 *       docs/tasks/posts/draft/03-draft-listing-and-publish.md
 *
 * 【初心者向け】同じ PATCH で 3 つの場面を扱う。`status` と現在の状態の組み合わせで分岐する。
 *   1. 公開済みの投稿の編集（status 省略 or published）: 必須項目を検証し、位置・スポットの変更も受ける。
 *      `created_at`（新着順の基準）は更新しない（3.3.3）
 *   2. 下書きの更新（status: draft）: 必須項目が空でもよい。位置だけ保存されることもある
 *   3. 下書きの公開（下書き → published）: 必須項目を検証し、スポットを確定して published_at を今にする。
 *      このとき初めてログ・バッジ・しおりの自動チェックを行う（作成と同じ扱い）
 * 投稿者本人のみ操作できる。共同アルバムのオーナーであっても他人の投稿は編集不可（3.3.3）。
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

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: existing, error: fetchError } = await admin
    .from("posts")
    .select("id, user_id, status, trip_id, spot_id, lat, lng")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  // 他人の投稿は、存在自体を伏せる必要はないため403で明示的に拒否する
  if (existing.user_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // 公開済みの投稿を下書きに戻すことはできない（公開は一方通行）
  const wasDraft = existing.status === "draft";
  const requestedStatus = body.status === "draft" ? "draft" : "published";
  if (!wasDraft && requestedStatus === "draft") {
    return NextResponse.json({ error: "cannot_unpublish" }, { status: 400 });
  }
  const isPublishing = wasDraft && requestedStatus === "published";

  // 位置が省略されたら現在の値を使う（下書きの部分更新に対応）
  const validation = validatePostInput({
    ...body,
    status: requestedStatus,
    lat: typeof body.lat === "number" ? body.lat : existing.lat,
    lng: typeof body.lng === "number" ? body.lng : existing.lng,
  });
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const fields = validation.fields;
  const isDraft = fields.status === "draft";

  // 下書きの保存はレート制限（1 時間 60 件）の対象
  if (isDraft) {
    try {
      const allowed = await isWithinRateLimit(
        admin,
        user.id,
        RATE_LIMIT_ACTIONS.draftSave.actionType,
        RATE_LIMIT_ACTIONS.draftSave.windowSeconds,
        RATE_LIMIT_ACTIONS.draftSave.limit
      );
      if (!allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    } catch {
      return NextResponse.json({ error: "rate_limit_unavailable" }, { status: 503 });
    }
  }

  // アルバム名。省略時は現在の旅行のまま、空文字は「日常」（v3.1）
  let tripId: string = existing.trip_id;
  if (typeof body.tripTitle === "string") {
    try {
      tripId = await resolveTripId(admin, user.id, body.tripTitle, { allowDaily: true });
    } catch (error) {
      if (error instanceof TripTitleValidationError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ error: "trip_resolution_failed" }, { status: 500 });
    }
  }

  // スポット。公開状態では必ず確定させる。下書きは選択済み ID だけ保持（無ければ null）
  const requestedSpotId = typeof body.spotId === "string" && body.spotId.length > 0 ? body.spotId : null;
  const spotCleared = body.spotId === null;
  let spotId: string | null = spotCleared ? null : (requestedSpotId ?? existing.spot_id ?? null);
  let prefecture: string | null = null;
  if (!isDraft) {
    const finalized = await finalizeSpotForPost(
      admin,
      spotId ? { spotId } : { lat: fields.lat, lng: fields.lng, name: typeof body.spotName === "string" ? body.spotName : null, createdBy: user.id }
    );
    if (!finalized.ok) {
      const status = finalized.error === "nearby_lookup_failed" ? 503 : finalized.error === "insert_failed" ? 500 : 400;
      return NextResponse.json({ error: finalized.error }, { status });
    }
    spotId = finalized.spot.id;
    prefecture = finalized.spot.prefecture;
  }

  // 公開投稿は写真が 1 点以上必要（下書きから公開するときに確かめる。編集時は写真 API 側が最後の 1 枚の削除を拒む）
  let mediaCount = 0;
  if (isPublishing) {
    const { count } = await admin.from("post_photos").select("id", { count: "exact", head: true }).eq("post_id", id);
    mediaCount = count ?? 0;
    if (mediaCount === 0) {
      return NextResponse.json({ error: "photo_required" }, { status: 400 });
    }
  }

  // created_atは含めない（3.3.3「編集しても投稿日時は更新しない」）。下書きの公開は published_at を今にする
  const { error: updateError } = await admin
    .from("posts")
    .update({
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
      ...(isPublishing ? { published_at: new Date().toISOString() } : {}),
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (updateError) {
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  let newBadges: { type: string; label: string }[] = [];
  if (isPublishing && spotId) {
    // 下書きからの公開は「投稿の作成」として扱う
    newBadges = await afterPostPublished(admin, {
      postId: id,
      userId: user.id,
      tripId,
      spotId,
      prefecture,
      visibility: fields.visibility,
      mediaCount,
      fromDraft: true,
    });
  } else if (!isDraft) {
    // 要件7.5: 投稿の編集
    await recordOperation(admin, {
      actionType: "post_update",
      userId: user.id,
      targetId: id,
      detail: { visibility: fields.visibility },
    });

    // F-BG Task2: スポットが変わると投稿の都道府県も変わるため、編集後にもバッジを判定する（#251）。
    // 投稿数は編集で増えないが、既得分は upsert で弾かれるので同じ関数でよい。失敗しても編集は成功させる
    try {
      const awarded = await evaluatePostBadges(admin, user.id, prefecture);
      newBadges = awarded.map((type) => ({ type, label: findBadgeDefinition(type)?.label ?? type }));
    } catch (error) {
      console.error("[badges] evaluatePostBadges failed (post update)", error);
    }
  }

  return NextResponse.json({ postId: id, status: fields.status, newBadges });
}

/**
 * F-PO-03 Task1: 投稿削除（カスケード削除）
 * 出典: docs/tasks/posts/post-delete/01-post-delete-handler.md
 *
 * 投稿者本人のみ削除できる（共同アルバムのオーナーであっても他人の投稿は削除不可、3.3.3）。
 * コメント・いいね・post_photosは posts への外部キーが on delete cascade のため、
 * posts の1回のDELETEと同一トランザクションで消える。
 * trips（旅行／アルバム）自体は削除しない。投稿が0件になったアルバムを
 * 一覧に出さない扱いは、一覧側の取得条件で行う（3.3.3、Task2）。
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: post, error: fetchError } = await admin
    .from("posts")
    .select("id, user_id")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
  if (!post) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (post.user_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // カスケードでpost_photosの行が消えるため、実ファイルのパスは削除前に控える
  const { data: photos } = await admin
    .from("post_photos")
    .select("storage_url")
    .eq("post_id", id);

  const { error: deleteError } = await admin
    .from("posts")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (deleteError) {
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }

  // Storageの削除に失敗しても投稿は消えている。孤立ファイルが残るだけなのでエラーにしない
  await removeStorageObjects(
    admin,
    (photos ?? []).map((photo) => photo.storage_url)
  );

  // 要件7.5: 投稿の削除。対象は既に消えているが、監査のためIDは残す
  await recordOperation(admin, {
    actionType: "post_delete",
    userId: user.id,
    targetId: id,
    detail: { photoCount: photos?.length ?? 0 },
  });

  return NextResponse.json({ ok: true });
}
