/**
 * pin-display-rules-v3 Task1: ピン種別ごとの色・形状・記号の定義（8 種別）
 * 出典: docs/tasks/shared-ui/pin-display-rules-v3/01-pin-types-and-icons.md
 *       要件定義書 v3.0 4.5.3
 *
 * 【初心者向け】色は theme（globals.css）の変数名（token）で持ち、描画するときに実際の色に解決する。
 *   - 画面内の SVG（PinIcon）は `var(--accent)` のように CSS 変数をそのまま使える
 *   - Google マップのマーカー（pin-marker-icon）は画像（data URL）なので CSS 変数が効かない。
 *     `resolvePinColor()` で getComputedStyle から現在の色（ライト／ダーク）を読み取って埋め込む
 * 色だけに頼らず、形状（丸／ひし形／破線）と記号（チェック・番号）でも見分けられるようにする（7.7）。
 */
export type PinType =
  | "post" // みんなの投稿（公開投稿があるスポット）
  | "saved" // 保存済み（行きたい・しおり）
  | "posted" // 自分の投稿があるスポット（あしあと）
  | "draft" // 自分の下書き
  | "focus" // 「地図で見る」で開いた対象・探すモードでめくったカード
  | "numbered" // しおりの訪問順（Day の色＋番号）
  | "cluster"; // まとめ表示

/** v1 の呼び名。map-display-v3 で置き換えるまでの互換用 */
export type LegacyPinType = "normal" | "wishlist";
export type AnyPinType = PinType | LegacyPinType;

export type PinColorToken = "accent" | "saved" | "done" | "muted" | "ink" | "surface";

export interface PinStyle {
  type: PinType;
  /** globals.css の変数名 */
  color: PinColorToken;
  shape: "circle" | "diamond";
  /** 中央に重ねる記号 */
  glyph: "dot" | "heart" | "check" | "pencil" | "halo" | "number" | "count";
  dashed?: boolean;
  label: string;
}

export const PIN_STYLES: Record<PinType, PinStyle> = {
  post: { type: "post", color: "accent", shape: "circle", glyph: "dot", label: "みんなの投稿" },
  saved: { type: "saved", color: "saved", shape: "diamond", glyph: "heart", label: "保存済み" },
  posted: { type: "posted", color: "accent", shape: "circle", glyph: "check", label: "投稿済みのスポット" },
  draft: { type: "draft", color: "muted", shape: "circle", glyph: "pencil", dashed: true, label: "下書き" },
  focus: { type: "focus", color: "accent", shape: "circle", glyph: "halo", label: "選択中のスポット" },
  numbered: { type: "numbered", color: "accent", shape: "circle", glyph: "number", label: "しおりのスポット" },
  cluster: { type: "cluster", color: "ink", shape: "circle", glyph: "count", label: "まとめ表示" },
};

const LEGACY_MAP: Record<LegacyPinType, PinType> = { normal: "post", wishlist: "saved" };

export function normalizePinType(type: AnyPinType): PinType {
  return type in LEGACY_MAP ? LEGACY_MAP[type as LegacyPinType] : (type as PinType);
}

export function getPinStyle(type: AnyPinType): PinStyle {
  return PIN_STYLES[normalizePinType(type)];
}

/** getComputedStyle が使えない環境（SSR・テスト）で使うライトの値。globals.css の :root と同じ */
export const PIN_COLOR_FALLBACK: Record<PinColorToken, string> = {
  accent: "#2f7fd8",
  saved: "#d9414a",
  done: "#3d7a5c",
  muted: "#7b8794",
  ink: "#1e2a38",
  surface: "#ffffff",
};

/** Day ごとの番号ピンの色（しおり表示。「すべて」で全日を色分けする） */
export const DAY_PIN_COLORS = ["#2f7fd8", "#d9694a", "#3d7a5c", "#8e5bd6", "#d89a1f", "#1f9ba8", "#c2418f"] as const;

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
