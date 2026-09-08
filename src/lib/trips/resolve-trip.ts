import type { SupabaseClient } from "@supabase/supabase-js";
import { graphemeLength } from "@/lib/text/grapheme-length";
import { MAX_TRIP_TITLE_LENGTH } from "./constants";

/**
 * F-PO-01 旅行タイトル Task2: 旅行タイトル作成・紐付けロジック
 * 出典: docs/tasks/posts/trip-title/02-trip-resolution-logic.md
 *
 * 投稿作成・編集時に入力された旅行タイトルから`trip_id`を解決する。
 * トリム後の完全一致で本人の既存`trips`を探し、無ければ新規作成する（要件定義書3.3.4）。
 * タイトルの一意性は同一ユーザー内でのみ有効なため、検索は必ずuser_idで絞る。
 */
export class TripTitleValidationError extends Error {}

export function normalizeTripTitle(rawTitle: string): string {
  return rawTitle.trim();
}

export function assertValidTripTitle(title: string): void {
  if (title.length === 0) {
    throw new TripTitleValidationError("trip_title_required");
  }
  if (graphemeLength(title) > MAX_TRIP_TITLE_LENGTH) {
    throw new TripTitleValidationError("trip_title_too_long");
  }
}

export async function resolveTripId(
  supabase: SupabaseClient,
  userId: string,
  rawTitle: string
): Promise<string> {
  const title = normalizeTripTitle(rawTitle);
  assertValidTripTitle(title);

  const { data: existing, error: selectError } = await supabase
    .from("trips")
    .select("id")
    .eq("user_id", userId)
    .eq("title", title)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }

  if (existing) {
    return existing.id;
  }

  // 同一ユーザーの同時投稿で重複が起きた場合は、一意制約(trips_user_title_unique)に
  // 弾かれるため、その時は既存行を引き直す
  const { data: created, error: insertError } = await supabase
    .from("trips")
    .insert({ user_id: userId, title })
    .select("id")
    .single();

  if (insertError) {
    const { data: raced } = await supabase
      .from("trips")
      .select("id")
      .eq("user_id", userId)
      .eq("title", title)
      .maybeSingle();

    if (raced) {
      return raced.id;
    }
    throw insertError;
  }

  return created.id;
}
