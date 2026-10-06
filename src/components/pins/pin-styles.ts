import type { PostCategory } from "@/lib/posts/constants";

/**
 * pin-display-rules-v3 Task1 / pin-categories Task1（2026-09-26 全面改訂）: ピンの見た目の定義
 * 出典: docs/tasks/shared-ui/pin-categories/01-teardrop-and-category-icons.md
 *       要件定義書 4.5.3「ピンの表示ルール」
 *
 * 【初心者向け】2026-09-26 に「何を何で表すか」を整理し直した。
 *   形  … 全部 **しずく型**（先端が座標を指す）。クラスタだけ丸、下書きは破線のしずく
 *   色  … **カテゴリ**（グルメ＝オレンジ…の 7 色）。現在地の青とは違う色だけを使う
 *   記号 … カテゴリの絵（フォーク・カメラ・山…）。色が見分けられなくても分かるように必ず入れる
 *   状態 … 右肩の小さな**バッジ**（保存済み＝赤いハート、自分の投稿＝緑のチェック）
 * 前は色が状態を表していた（青＝みんなの投稿、赤＝保存済み）が、現在地の青と同じ色で見分けが
 * 付かなかったため、形で現在地と分け、色はカテゴリに譲った。
 *
 * 画面用（PinIcon.tsx）と地図マーカー用（pin-marker-icon.ts）の 2 つが同じ図形を描くので、
 * 「どう描くか」の判断はこのファイルの resolvePinLook() だけに置き、両者はその結果を描くだけにする。
 */
export type PinType =
  | "post" // みんなの投稿（公開投稿があるスポット）
  | "saved" // 保存済み（行きたい・しおり）
  | "posted" // 自分の投稿があるスポット（あしあと）
  | "draft" // 自分の下書き
  | "focus" // 「地図で見る」で開いた対象・探すモードでめくったカード
  | "numbered" // しおりの訪問順（Day の色＋番号）
  | "cluster"; // まとめ表示。※ 地図のまとめ表示は MarkerClusterer が自前で描くので、今のところ未使用（4.5.3）

/** v1 の呼び名。map-display-v3 で置き換えるまでの互換用 */
export type LegacyPinType = "normal" | "wishlist";
export type AnyPinType = PinType | LegacyPinType;

/** ピンの中に描く記号 */
export type PinGlyph = "food" | "sight" | "nature" | "activity" | "event" | "shopping" | "stay" | "dot" | "pencil" | "number" | "count";

/** 右肩のバッジ（状態） */
export type PinBadge = "heart" | "check";

/** globals.css の変数名 */
export type PinColorToken =
  | "pin-food"
  | "pin-sight"
  | "pin-nature"
  | "pin-activity"
  | "pin-event"
  | "pin-shopping"
  | "pin-stay"
  | "pin-none"
  | "muted"
  | "ink"
  | "surface"
  | "saved"
  | "done";

/** カテゴリ → 色と記号（4.5.3 の表） */
export const CATEGORY_PIN_STYLE: Record<PostCategory, { color: PinColorToken; glyph: PinGlyph }> = {
  グルメ: { color: "pin-food", glyph: "food" },
  観光スポット: { color: "pin-sight", glyph: "sight" },
  "自然・景勝地": { color: "pin-nature", glyph: "nature" },
  "体験・アクティビティ": { color: "pin-activity", glyph: "activity" },
  "エンタメ・イベント": { color: "pin-event", glyph: "event" },
  ショッピング: { color: "pin-shopping", glyph: "shopping" },
  宿泊施設: { color: "pin-stay", glyph: "stay" },
};

/** 種別ごとの名前（読み上げ・凡例） */
export const PIN_TYPE_LABELS: Record<PinType, string> = {
  post: "みんなの投稿",
  saved: "行きたい",
  posted: "投稿済みのスポット",
  draft: "下書き",
  focus: "選択中のスポット",
  numbered: "しおりのスポット",
  cluster: "まとめ表示",
};

/** Day ごとの番号ピンの色（しおり表示。「すべて」で全日を色分けする） */
export const DAY_PIN_COLORS = ["#2f7fd8", "#d9694a", "#3d7a5c", "#8e5bd6", "#d89a1f", "#1f9ba8", "#c2418f"] as const;

const LEGACY_MAP: Record<LegacyPinType, PinType> = { normal: "post", wishlist: "saved" };

export function normalizePinType(type: AnyPinType): PinType {
  return type in LEGACY_MAP ? LEGACY_MAP[type as LegacyPinType] : (type as PinType);
}

export interface PinLookInput {
  /** そのスポットのカテゴリ（公開投稿から決める。無ければ灰色） */
  category?: PostCategory | null;
  /** numbered: Day（1 始まり）。色分けに使う */
  dayIndex?: number | null;
  /** numbered: 済み（灰色にする） */
  done?: boolean;
  /** numbered: 訪問順 / cluster: 件数 */
  label?: string | number;
}

/** 描く側（PinIcon / pin-marker-icon）が必要とするものを全部まとめたもの */
export interface PinLook {
  type: PinType;
  shape: "teardrop" | "circle";
  /** 色。token なら CSS 変数（テーマで変わる）、value なら固定値（Day の色） */
  color: { token: PinColorToken } | { value: string };
  glyph: PinGlyph;
  badge: PinBadge | null;
  /** 外側の淡い輪（フォーカス） */
  halo: boolean;
  /** 輪郭を破線にする（下書き） */
  dashed: boolean;
  label: string;
}

/**
 * 種別とカテゴリから「どう描くか」を決める。画面用と地図マーカー用で共通。
 *
 * バッジの出し分けは種別に従う。同じスポットが複数に当てはまるときの種別は
 * resolvePinPriority() が画面ごとに決めている（SC-02 は保存済み優先、SC-12 は投稿済み優先）。
 */
export function resolvePinLook(type: AnyPinType, input: PinLookInput = {}): PinLook {
  const kind = normalizePinType(type);
  const label = PIN_TYPE_LABELS[kind];

  if (kind === "cluster") {
    return { type: kind, shape: "circle", color: { token: "ink" }, glyph: "count", badge: null, halo: false, dashed: false, label };
  }
  if (kind === "numbered") {
    const color = input.done
      ? ({ token: "muted" } as const)
      : ({ value: DAY_PIN_COLORS[((input.dayIndex ?? 1) - 1 + DAY_PIN_COLORS.length) % DAY_PIN_COLORS.length] } as const);
    return { type: kind, shape: "teardrop", color, glyph: "number", badge: null, halo: false, dashed: false, label };
  }
  if (kind === "draft") {
    return { type: kind, shape: "teardrop", color: { token: "muted" }, glyph: "pencil", badge: null, halo: false, dashed: true, label };
  }

  const category = input.category ? CATEGORY_PIN_STYLE[input.category] : null;
  return {
    type: kind,
    shape: "teardrop",
    color: { token: category?.color ?? "pin-none" },
    glyph: category?.glyph ?? "dot",
    badge: kind === "saved" ? "heart" : kind === "posted" ? "check" : null,
    halo: kind === "focus",
    dashed: false,
    label,
  };
}

/** getComputedStyle が使えない環境（SSR・テスト）で使うライトの値。globals.css の :root と同じ */
export const PIN_COLOR_FALLBACK: Record<PinColorToken, string> = {
  "pin-food": "#e2703a",
  "pin-sight": "#c4478c",
  "pin-nature": "#3c8c5e",
  "pin-activity": "#7a57d1",
  "pin-event": "#d8425f",
  "pin-shopping": "#0e93a0",
  "pin-stay": "#9a6b33",
  "pin-none": "#7b8794",
  muted: "#7b8794",
  ink: "#1e2a38",
  surface: "#ffffff",
  saved: "#d9414a",
  done: "#3d7a5c",
};

/**
 * ブラウザでは現在のテーマの実際の色を返す（ダークなら夜の値）。取れなければライトの既定値。
 */
export function resolvePinColor(token: PinColorToken): string {
  if (typeof window !== "undefined" && typeof getComputedStyle === "function") {
    const value = getComputedStyle(document.documentElement).getPropertyValue(`--${token}`).trim();
    if (value) return value;
  }
  return PIN_COLOR_FALLBACK[token];
}

/** マップ画面ごとの優先順位（同じスポットが複数種別に該当するとき） */
export function resolvePinPriority(
  screen: "map" | "mymap",
  flags: { hasPost?: boolean; isSaved?: boolean; isPosted?: boolean; isDraft?: boolean }
): PinType {
  if (flags.isDraft) return "draft";
  if (screen === "map") {
    if (flags.isSaved) return "saved";
    return "post";
  }
  if (flags.isPosted) return "posted";
  if (flags.isSaved) return "saved";
  return "post";
}
