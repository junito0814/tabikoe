/**
 * F-BG Task1: バッジ種別・獲得閾値の共通カタログ
 * 出典: docs/tasks/badges/status-badges/01-badge-catalog-definition.md
 *       要件定義書3.7
 *
 * `badges.badge_type` は「種別:レベル」の1列（20260911000001_create_badges_table.sql の
 * CHECK制約と対応）。閾値をここで変える場合はマイグレーションも合わせて変えること。
 */
export const POST_COUNT_THRESHOLDS = [1, 10, 50, 100] as const;
export const LIKE_COUNT_THRESHOLDS = [1, 10, 50, 100, 200] as const;

/** 都道府県バッジの対象。Geocoding API（language=ja）の administrative_area_level_1 と同じ表記 */
export const PREFECTURES = [
  "北海道",
  "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県",
  "岐阜県", "静岡県", "愛知県", "三重県",
  "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県",
  "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県",
  "福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
] as const;

export type Prefecture = (typeof PREFECTURES)[number];
export type BadgeCategory = "prefecture" | "post_count" | "like_count";

export interface BadgeDefinition {
  /** badges.badge_type に保存する文字列 */
  type: string;
  category: BadgeCategory;
  label: string;
  description: string;
}

export function isPrefecture(value: string | null | undefined): value is Prefecture {
  return typeof value === "string" && (PREFECTURES as readonly string[]).includes(value);
}

/** 都道府県バッジの badge_type。対象外の地名（国外等）は null */
export function badgeTypeForPrefecture(prefecture: string | null | undefined): string | null {
  return isPrefecture(prefecture) ? `prefecture:${prefecture}` : null;
}

/** 累計投稿数がちょうど閾値に達した時だけ badge_type を返す。中間の件数（例: 5件）は null */
export function badgeTypeForPostCount(count: number): string | null {
  return (POST_COUNT_THRESHOLDS as readonly number[]).includes(count) ? `post_count:${count}` : null;
}

/** 累計獲得いいね数がちょうど閾値に達した時だけ badge_type を返す。中間の件数は null */
export function badgeTypeForLikeCount(count: number): string | null {
  return (LIKE_COUNT_THRESHOLDS as readonly number[]).includes(count) ? `like_count:${count}` : null;
}

/**
 * 累計件数以下の閾値すべての badge_type を返す（到達済みのはずのバッジ一式）。
 * 付与処理はこれを upsert し、既に持っているものは一意制約で無視されるため、
 * 過去に付与が失敗していても次の到達時に取りこぼしを回収できる。
 */
export function reachedPostCountBadgeTypes(count: number): string[] {
  return POST_COUNT_THRESHOLDS.filter((t) => t <= count).map((t) => `post_count:${t}`);
}

export function reachedLikeCountBadgeTypes(count: number): string[] {
  return LIKE_COUNT_THRESHOLDS.filter((t) => t <= count).map((t) => `like_count:${t}`);
}

/** SC-10 の一覧順: 投稿数 → いいね数 → 都道府県（北から） */
export const BADGE_CATALOG: readonly BadgeDefinition[] = [
  ...POST_COUNT_THRESHOLDS.map<BadgeDefinition>((threshold) => ({
    type: `post_count:${threshold}`,
    category: "post_count",
    label: `投稿${threshold}件`,
    description: `累計${threshold}件の投稿を達成`,
  })),
  ...LIKE_COUNT_THRESHOLDS.map<BadgeDefinition>((threshold) => ({
    type: `like_count:${threshold}`,
    category: "like_count",
    label: `いいね${threshold}件`,
    description: `累計${threshold}件のいいねを獲得`,
  })),
  ...PREFECTURES.map<BadgeDefinition>((prefecture) => ({
    type: `prefecture:${prefecture}`,
    category: "prefecture",
    label: prefecture,
    description: `${prefecture}で投稿`,
  })),
];

const CATALOG_BY_TYPE = new Map(BADGE_CATALOG.map((badge) => [badge.type, badge]));

export function findBadgeDefinition(type: string): BadgeDefinition | undefined {
  return CATALOG_BY_TYPE.get(type);
}
