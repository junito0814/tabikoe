import { graphemeLength } from "@/lib/text/grapheme-length";
import {
  MAX_POST_COMMENT_LENGTH,
  MAX_POST_COST,
  MAX_POST_RATING,
  MIN_POST_COST,
  MIN_POST_RATING,
  POST_CATEGORIES,
  POST_DURATIONS,
  POST_VISIBILITIES,
  todayInJst,
  type PostCategory,
  type PostDuration,
  type PostVisibility,
} from "./constants";

/**
 * 投稿の入力検証（要件定義書3.3.1）
 *
 * 投稿作成（F-PO-01 Task3）と投稿編集（F-PO-02 Task1）で同じルールを適用するため、
 * 両方のRoute Handlerから呼び出す共通処理として切り出している。
 */
export interface ValidatedPostFields {
  category: PostCategory;
  duration: PostDuration;
  visibility: PostVisibility;
  rating: number;
  cost: number | null;
  visitDate: string | null;
  comment: string | null;
}

export interface PostInput {
  category?: unknown;
  duration?: unknown;
  visibility?: unknown;
  rating?: unknown;
  cost?: unknown;
  visitDate?: unknown;
  comment?: unknown;
}

/** 検証に失敗した理由。呼び出し元がそのままレスポンスのerrorに使う。 */
export type PostValidationError =
  | "invalid_category"
  | "invalid_duration"
  | "invalid_visibility"
  | "invalid_rating"
  | "invalid_cost"
  | "invalid_visit_date"
  | "future_visit_date"
  | "comment_too_long";

export type PostValidationResult =
  | { ok: true; fields: ValidatedPostFields }
  | { ok: false; error: PostValidationError };

export function validatePostInput(input: PostInput): PostValidationResult {
  const { category, duration, visibility } = input;

  if (typeof category !== "string" || !POST_CATEGORIES.includes(category as PostCategory)) {
    return { ok: false, error: "invalid_category" };
  }
  if (typeof duration !== "string" || !POST_DURATIONS.includes(duration as PostDuration)) {
    return { ok: false, error: "invalid_duration" };
  }
  if (
    typeof visibility !== "string" ||
    !POST_VISIBILITIES.includes(visibility as PostVisibility)
  ) {
    return { ok: false, error: "invalid_visibility" };
  }

  const rating = input.rating;
  if (
    typeof rating !== "number" ||
    !Number.isInteger(rating) ||
    rating < MIN_POST_RATING ||
    rating > MAX_POST_RATING
  ) {
    return { ok: false, error: "invalid_rating" };
  }

  // 費用は任意。未入力はnullとして扱う
  let cost: number | null = null;
  if (input.cost !== null && input.cost !== undefined && input.cost !== "") {
    if (
      typeof input.cost !== "number" ||
      !Number.isInteger(input.cost) ||
      input.cost < MIN_POST_COST ||
      input.cost > MAX_POST_COST
    ) {
      return { ok: false, error: "invalid_cost" };
    }
    cost = input.cost;
  }

  // 訪問日は任意。指定された場合はJST基準で未来日を認めない
  let visitDate: string | null = null;
  if (typeof input.visitDate === "string" && input.visitDate.length > 0) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.visitDate)) {
      return { ok: false, error: "invalid_visit_date" };
    }
    if (input.visitDate > todayInJst()) {
      return { ok: false, error: "future_visit_date" };
    }
    visitDate = input.visitDate;
  }

  const comment = typeof input.comment === "string" ? input.comment : "";
  if (graphemeLength(comment) > MAX_POST_COMMENT_LENGTH) {
    return { ok: false, error: "comment_too_long" };
  }

  return {
    ok: true,
    fields: {
      category: category as PostCategory,
      duration: duration as PostDuration,
      visibility: visibility as PostVisibility,
      rating,
      cost,
      visitDate,
      comment: comment.length > 0 ? comment : null,
    },
  };
}
