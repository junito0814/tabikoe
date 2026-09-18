import { graphemeLength } from "@/lib/text/grapheme-length";
import {
  MAX_POST_COMMENT_LENGTH,
  MAX_POST_COST,
  MAX_POST_RATING,
  MIN_POST_COST,
  MIN_POST_RATING,
  POST_CATEGORIES,
  POST_DURATIONS,
  POST_STATUSES,
  POST_VISIBILITIES,
  todayInJst,
  type PostCategory,
  type PostDuration,
  type PostStatus,
  type PostVisibility,
} from "./constants";

/**
 * 投稿の入力検証（要件定義書 v3.0 3.3.1・3.3.7）
 *
 * 投稿作成（post-creation-v3 Task1）・投稿編集（post-edit-v3）・下書き（draft）で同じルールを適用するため、
 * 各 Route Handler から呼び出す共通処理として切り出している。
 *
 * 【初心者向け】ブラウザから来た値は「何が入っているか分からない」前提で `unknown` 型で受け、
 * ここで 1 つずつ型と範囲を確かめてから、安全な型（ValidatedPostFields）に変換して返す。
 * 戻り値は { ok: true, fields } か { ok: false, error } のどちらか（判別可能なユニオン型）。
 * 呼び出し側は `if (!validation.ok) return 400` と書けばよい。
 *
 * v3.0 の変更点:
 *   - status（draft / published）。下書きは必須項目が空でもよい（位置だけの下書きが成立する）
 *   - 位置（lat / lng）は常に必須（地図のピンの座標）
 *   - 日付（visitDate）は公開時に必須。未指定なら今日（JST）を入れる
 *   - カテゴリは 7 値
 */
export interface ValidatedPostFields {
  status: PostStatus;
  category: PostCategory | null;
  duration: PostDuration | null;
  visibility: PostVisibility;
  rating: number | null;
  cost: number | null;
  visitDate: string | null;
  comment: string | null;
  lat: number;
  lng: number;
}

export interface PostInput {
  status?: unknown;
  category?: unknown;
  duration?: unknown;
  visibility?: unknown;
  rating?: unknown;
  cost?: unknown;
  visitDate?: unknown;
  comment?: unknown;
  lat?: unknown;
  lng?: unknown;
}

/** 検証に失敗した理由。呼び出し元がそのままレスポンスのerrorに使う。 */
export type PostValidationError =
  | "invalid_status"
  | "invalid_category"
  | "invalid_duration"
  | "invalid_visibility"
  | "invalid_rating"
  | "invalid_cost"
  | "invalid_visit_date"
  | "future_visit_date"
  | "invalid_location"
  | "comment_too_long";

export type PostValidationResult =
  | { ok: true; fields: ValidatedPostFields }
  | { ok: false; error: PostValidationError };

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

export function validatePostInput(input: PostInput): PostValidationResult {
  // 状態。省略時は公開（v1 からの呼び出し互換）
  const status: PostStatus = isBlank(input.status) ? "published" : (input.status as PostStatus);
  if (!POST_STATUSES.includes(status)) {
    return { ok: false, error: "invalid_status" };
  }
  const isDraft = status === "draft";

  // 位置は下書きでも必須（ピンの座標が無い投稿は成立しない）
  const { lat, lng } = input;
  if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { ok: false, error: "invalid_location" };
  }

  // 公開設定は既定「公開」
  const visibility: PostVisibility = isBlank(input.visibility) ? "public" : (input.visibility as PostVisibility);
  if (!POST_VISIBILITIES.includes(visibility)) {
    return { ok: false, error: "invalid_visibility" };
  }

  // 以下、公開なら必須・下書きなら任意の項目
  let category: PostCategory | null = null;
  if (!isBlank(input.category)) {
    if (typeof input.category !== "string" || !POST_CATEGORIES.includes(input.category as PostCategory)) {
      return { ok: false, error: "invalid_category" };
    }
    category = input.category as PostCategory;
  } else if (!isDraft) {
    return { ok: false, error: "invalid_category" };
  }

  let duration: PostDuration | null = null;
  if (!isBlank(input.duration)) {
    if (typeof input.duration !== "string" || !POST_DURATIONS.includes(input.duration as PostDuration)) {
      return { ok: false, error: "invalid_duration" };
    }
    duration = input.duration as PostDuration;
  } else if (!isDraft) {
    return { ok: false, error: "invalid_duration" };
  }

  let rating: number | null = null;
  if (!isBlank(input.rating) && input.rating !== 0) {
    if (typeof input.rating !== "number" || !Number.isInteger(input.rating) || input.rating < MIN_POST_RATING || input.rating > MAX_POST_RATING) {
      return { ok: false, error: "invalid_rating" };
    }
    rating = input.rating;
  } else if (!isDraft) {
    return { ok: false, error: "invalid_rating" };
  }

  // 費用は任意。未入力はnullとして扱う
  let cost: number | null = null;
  if (!isBlank(input.cost)) {
    if (typeof input.cost !== "number" || !Number.isInteger(input.cost) || input.cost < MIN_POST_COST || input.cost > MAX_POST_COST) {
      return { ok: false, error: "invalid_cost" };
    }
    cost = input.cost;
  }

  // 訪問日: 公開では必須（未指定なら今日）。JST基準で未来日を認めない
  let visitDate: string | null = null;
  if (typeof input.visitDate === "string" && input.visitDate.length > 0) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.visitDate)) {
      return { ok: false, error: "invalid_visit_date" };
    }
    if (input.visitDate > todayInJst()) {
      return { ok: false, error: "future_visit_date" };
    }
    visitDate = input.visitDate;
  } else if (!isBlank(input.visitDate)) {
    return { ok: false, error: "invalid_visit_date" };
  } else if (!isDraft) {
    visitDate = todayInJst();
  }

  const comment = typeof input.comment === "string" ? input.comment : "";
  if (graphemeLength(comment) > MAX_POST_COMMENT_LENGTH) {
    return { ok: false, error: "comment_too_long" };
  }

  return {
    ok: true,
    fields: {
      status,
      category,
      duration,
      visibility,
      rating,
      cost,
      visitDate,
      comment: comment.length > 0 ? comment : null,
      lat,
      lng,
    },
  };
}
