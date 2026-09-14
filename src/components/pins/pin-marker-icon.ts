import { PIN_STYLES, type PinType } from "./pin-styles";

/** Google Maps のマーカーに載せる際のアイコンサイズ（px） */
export const PIN_MARKER_SIZE = 32;

/**
 * PinIcon（React）と同じ図形を、Google Maps の `Marker.icon` に渡せる SVG 文字列として組み立てる。
 *
 * マーカーは React ツリーの外（Maps API が管理する DOM）に描かれるため、コンポーネントを直接置けない。
 * 図形の定義が PinIcon.tsx と二重になるのを避けるため、単体テストで両者の一致を検証している
 * （pin-marker-icon.test.ts）。PinIcon を変更したらこちらも合わせること。
 */
export function pinIconSvgMarkup(type: PinType): string {
  const style = PIN_STYLES[type];
  const shape =
    style.shape === "circle"
      ? `<circle cx="16" cy="16" r="12" fill="${style.color}"></circle>`
      : style.shape === "diamond"
        ? `<rect x="7" y="7" width="18" height="18" rx="2" fill="${style.color}" transform="rotate(45 16 16)"></rect>`
        : `<rect x="5" y="5" width="22" height="22" rx="5" fill="${style.color}"></rect>`;
  const glyph =
    style.type === "normal"
      ? `<circle cx="16" cy="16" r="3.5" fill="#fff"></circle>`
      : style.type === "wishlist"
        ? `<path d="M16 21.5c-4.2-2.9-7.2-5.6-7.2-9A4 4 0 0 1 16 10a4 4 0 0 1 7.2 2.5c0 3.4-3 6.1-7.2 9z" fill="#fff"></path>`
        : `<path d="M10.5 16.3l3.7 3.7 7.3-7.7" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"></path>`;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${PIN_MARKER_SIZE}" height="${PIN_MARKER_SIZE}" viewBox="0 0 32 32" role="img" aria-label="${style.label}">` +
    shape +
    glyph +
    `</svg>`
  );
}

/** `Marker.icon.url` に渡す data URL */
export function pinIconDataUrl(type: PinType): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(pinIconSvgMarkup(type))}`;
}
