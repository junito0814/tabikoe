/**
 * ピンの表示ルール Task1: ピン種別ごとのアイコン・色定義
 * 出典: docs/tasks/shared-ui/pin-display-rules/01-pin-icon-definitions.md
 *
 * 色のみに依存せず、形状・アイコンでも判別できるようにする（7.7 アクセシビリティ準拠）。
 */
export type PinType = "normal" | "wishlist" | "posted";

export interface PinStyle {
  type: PinType;
  color: string;
  shape: "circle" | "diamond" | "square";
  label: string;
}

export const PIN_STYLES: Record<PinType, PinStyle> = {
  normal: {
    type: "normal",
    color: "#9C9488",
    shape: "circle",
    label: "投稿があるスポット",
  },
  wishlist: {
    type: "wishlist",
    color: "#C4703F",
    shape: "diamond",
    label: "行きたいスポット",
  },
  posted: {
    type: "posted",
    color: "#3D7A5C",
    shape: "square",
    label: "投稿済みのスポット",
  },
};
