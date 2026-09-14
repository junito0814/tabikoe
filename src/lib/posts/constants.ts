/**
 * 投稿の入力規則（要件定義書3.3.1）
 * DB側の制約は20260908000014_add_posts_value_constraints.sqlに対応する定義がある。
 */
export const POST_CATEGORIES = [
  "グルメ",
  "観光スポット",
  "体験・アクティビティ",
  "宿泊施設",
  "イベント会場",
] as const;

export const POST_DURATIONS = [
  "30分以内",
  "1時間以内",
  "2時間以内",
  "3時間以内",
  "それ以上",
] as const;

export const POST_VISIBILITIES = ["public", "private"] as const;

export type PostCategory = (typeof POST_CATEGORIES)[number];
export type PostDuration = (typeof POST_DURATIONS)[number];
export type PostVisibility = (typeof POST_VISIBILITIES)[number];

/** 感想の最大文字数（書記素クラスタ単位） */
export const MAX_POST_COMMENT_LENGTH = 4000;

/** 費用（円、1人あたり） */
export const MIN_POST_COST = 0;
export const MAX_POST_COST = 999999;

/** 星評価 */
export const MIN_POST_RATING = 1;
export const MAX_POST_RATING = 5;

/** 投稿作成のレート制限（1ユーザーにつき1時間20件まで） */
export const POST_RATE_LIMIT_WINDOW_SECONDS = 3600;
export const POST_RATE_LIMIT_MAX_ATTEMPTS = 20;

export const POST_MEDIA_BUCKET = "post-media";

/** 動画の受付規則（要件定義書3.3.1・5.4）: MP4のみ、1点あたり最大100MB、再生時間1分以内 */
export const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024;
export const MAX_VIDEO_DURATION_SECONDS = 60;
export const ALLOWED_VIDEO_MIME_TYPE = "video/mp4";

/** 写真の受付規則（要件定義書5.4）: JPEG／PNG、1点あたり最大10MB */
export const MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024;
export const ALLOWED_PHOTO_MIME_TYPES = ["image/jpeg", "image/png"] as const;

/**
 * JST基準の「今日」をYYYY-MM-DD形式で返す。
 * 訪問日は投稿時点までの過去日（当日含む）のみ許可する（3.3.1、JST固定）。
 * サーバーのタイムゾーンに依存させないため、常にAsia/Tokyoで判定する。
 */
export function todayInJst(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
