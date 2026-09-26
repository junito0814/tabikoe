import { resolvePinColor, resolvePinLook, type AnyPinType } from "./pin-styles";
import { buildBadgeElements, buildGlyphElements, buildPinElements, type PinElement } from "./pin-shapes";
import type { PostCategory } from "@/lib/posts/constants";

/** Google Maps のマーカーに載せる際のアイコンサイズ（px） */
export const PIN_MARKER_SIZE = 32;

/**
 * マーカーの「座標を指す点」。
 * pin-categories Task1（2026-09-26）: しずく型にしたので、**先端（下端）**が実際の座標を指す。
 * 丸だった頃は中央（16, 16）だった。
 */
export const PIN_MARKER_ANCHOR = { x: 16, y: 30.4 } as const;
/** クラスタ（まとめ表示）は丸のままなので中央で指す */
export const CLUSTER_MARKER_ANCHOR = { x: 16, y: 16 } as const;

export interface PinMarkerOptions {
  /** numbered: 訪問順の番号 / cluster: 件数 */
  label?: string | number;
  /** numbered: Day（1 始まり）。色分けに使う */
  dayIndex?: number | null;
  /** numbered: 済み（灰色にする） */
  done?: boolean;
  /** そのスポットのカテゴリ（色と記号を決める） */
  category?: PostCategory | null;
}

/**
 * pin-display-rules-v3 Task1 / pin-categories Task1: PinIcon（React）と同じ図形を、
 * Google Maps の `Marker.icon` に渡せる SVG 文字列として組み立てる。
 *
 * 【初心者向け】マーカーは React ツリーの外（Maps API が管理する DOM）に描かれるため、コンポーネントを直接置けない。
 * そこで SVG を文字列で組み、data URL（画像）として渡す。画像の中では CSS 変数が効かないので、
 * `resolvePinColor()` で現在のテーマの色（16 進）を読んで埋め込む。
 * 図形そのものは pin-shapes.ts が決めるので、PinIcon とズレることはない。
 */
export function pinIconSvgMarkup(type: AnyPinType, options: PinMarkerOptions = {}): string {
  const look = resolvePinLook(type, options);
  const white = resolvePinColor("surface");
  const fill = "token" in look.color ? resolvePinColor(look.color.token) : look.color.value;

  const elements = [
    ...buildPinElements(look, { fill, white }),
    ...buildGlyphElements(look, { fill, white }, options.label),
    ...buildBadgeElements(look, { saved: resolvePinColor("saved"), done: resolvePinColor("done"), white }),
  ];

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${PIN_MARKER_SIZE}" height="${PIN_MARKER_SIZE}" viewBox="0 0 32 32" role="img" aria-label="${look.label}">` +
    elements.map(toMarkup).join("") +
    `</svg>`
  );
}

/** pin-shapes.ts の要素（タグと属性）を SVG の文字列にする */
function toMarkup(element: PinElement): string {
  const attrs = Object.entries(element.attrs)
    .map(([name, value]) => `${name}="${value}"`)
    .join(" ");
  return `<${element.tag} ${attrs}>${escapeText(element.text ?? "")}</${element.tag}>`;
}

function escapeText(value: string | number): string {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** そのピンが座標を指す点（しずくは先端、クラスタは中央） */
export function pinMarkerAnchor(type: AnyPinType): { x: number; y: number } {
  return resolvePinLook(type).shape === "circle" ? CLUSTER_MARKER_ANCHOR : PIN_MARKER_ANCHOR;
}

/** `Marker.icon.url` に渡す data URL */
export function pinIconDataUrl(type: AnyPinType, options: PinMarkerOptions = {}): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(pinIconSvgMarkup(type, options))}`;
}
