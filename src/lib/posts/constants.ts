/**
 * 投稿の入力規則（要件定義書3.3.1）
 * DB側の制約は20260908000014_add_posts_value_constraints.sql（v3.0 では 20260917000001）に対応する定義がある。
 * カテゴリは v3.0 で 7 つ（要件定義書 v3.0 3.3.1）。
 */
export const POST_CATEGORIES = [
  "グルメ",
  "観光スポット",
  "自然・景勝地",
  "体験・アクティビティ",
  "エンタメ・イベント",
  "ショッピング",
  "宿泊施設",
] as const;

/** v3.0 で廃止したカテゴリ。DB 側は 20260917000001 で「エンタメ・イベント」へ移行済み */
export const LEGACY_POST_CATEGORY_MAP: Record<string, PostCategory> = {
  イベント会場: "エンタメ・イベント",
};

/**
 * 滞在時間の選択肢（v3.2 feedback-0919 Task1: 7 択）。
 * 【初心者向け】入力（投稿・編集・絞り込み）で選べるのはこの 7 つ。v3.1 までの「それ以上」は新規では選べないが、
 * 既存の投稿に残っているので LEGACY_POST_DURATIONS として表示・絞り込みでだけ受け付ける。
 */
export const POST_DURATIONS = [
  "30分以内",
  "1時間以内",
  "2時間以内",
  "3時間以内",
  "半日",
  "1日",
  "宿泊",
] as const;
export type PostDuration = (typeof POST_DURATIONS)[number];
/** 旧値（v3.1 まで）。DB には残っているが、新しい入力では出さない */
export const LEGACY_POST_DURATIONS = ["それ以上"] as const;
/** 「半日以上」の束。絞り込みで 半日／1日／宿泊 のどれかを選んだら、旧「それ以上」も含める */
export const LONG_STAY_DURATIONS: readonly PostDuration[] = [
  "半日",
  "1日",
  "宿泊",
];
/** 宿泊施設を選んだときに自動で入れる滞在時間 */
export const LODGING_DURATION: PostDuration = "宿泊";
/** カテゴリが「宿泊施設」のとき、滞在時間が未選択なら自動で入れる（純粋関数。既に選んでいれば触らない） */
export function autoDurationForCategory(
  category: string,
  current: string,
): PostDuration | null {
  return category === "宿泊施設" && current === "" ? LODGING_DURATION : null;
}

export const POST_VISIBILITIES = ["public", "private"] as const;

/** 投稿の状態（v3.0）。draft＝下書き（本人だけに見える）、published＝公開済み */
export const POST_STATUSES = ["draft", "published"] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

/** 下書きの上限（1 ユーザーあたり。要件定義書 v3.0 3.3.7） */
export const MAX_DRAFTS_PER_USER = 20;

export type PostCategory = (typeof POST_CATEGORIES)[number];
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
