import { DAY_PIN_COLORS, getPinStyle, resolvePinColor, type AnyPinType } from "./pin-styles";

/** Google Maps のマーカーに載せる際のアイコンサイズ（px） */
export const PIN_MARKER_SIZE = 32;

export interface PinMarkerOptions {
  /** numbered: 訪問順の番号 / cluster: 件数 */
  label?: string | number;
  /** numbered: Day（1 始まり）。色分けに使う */
  dayIndex?: number | null;
  /** numbered: 済み（灰色にする） */
  done?: boolean;
}

/**
 * pin-display-rules-v3 Task1: PinIcon（React）と同じ図形を、Google Maps の `Marker.icon` に渡せる SVG 文字列として組み立てる。
 * 出典: docs/tasks/shared-ui/pin-display-rules-v3/01-pin-types-and-icons.md
 *
 * 【初心者向け】マーカーは React ツリーの外（Maps API が管理する DOM）に描かれるため、コンポーネントを直接置けない。
 * そこで SVG を文字列で組み立て、data URL（画像）として渡す。画像の中では CSS 変数が効かないので、
 * `resolvePinColor()` で現在のテーマの色（16 進）を読んで埋め込む。図形の定義が PinIcon.tsx と二重になるのを避けるため、
 * 単体テストで両者の一致（色以外）を検証している。PinIcon を変更したらこちらも合わせること。
 */
export function pinIconSvgMarkup(type: AnyPinType, options: PinMarkerOptions = {}): string {
  const style = getPinStyle(type);
  const white = resolvePinColor("surface");
  let fill = resolvePinColor(style.color);
  if (style.type === "numbered") {
    fill = options.done ? resolvePinColor("muted") : DAY_PIN_COLORS[((options.dayIndex ?? 1) - 1 + DAY_PIN_COLORS.length) % DAY_PIN_COLORS.length];
  }

  const halo = style.glyph === "halo" ? `<circle cx="16" cy="16" r="15" fill="${fill}" opacity="0.25"></circle>` : "";
  const shape =
    style.shape === "diamond"
      ? `<rect x="7" y="7" width="18" height="18" rx="2" fill="${fill}" transform="rotate(45 16 16)"></rect>`
      : style.dashed
        ? `<circle cx="16" cy="16" r="11" fill="${white}" stroke="${fill}" stroke-width="2" stroke-dasharray="4 3"></circle>`
        : `<circle cx="16" cy="16" r="${style.glyph === "halo" ? 10 : 12}" fill="${fill}"></circle>`;

  const glyph = (() => {
    switch (style.glyph) {
      case "dot":
      case "halo":
        return `<circle cx="16" cy="16" r="3.5" fill="${white}"></circle>`;
      case "heart":
        return `<path d="M16 21.5c-4.2-2.9-7.2-5.6-7.2-9A4 4 0 0 1 16 10a4 4 0 0 1 7.2 2.5c0 3.4-3 6.1-7.2 9z" fill="${white}"></path>`;
      case "check":
        return `<path d="M10.5 16.3l3.7 3.7 7.3-7.7" stroke="${white}" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"></path>`;
      case "pencil":
        return `<path d="M12 20l1-3 6-6 2 2-6 6z" fill="${fill}"></path>`;
      case "number":
      case "count":
        return `<text x="16" y="20.5" text-anchor="middle" font-size="12" font-weight="700" font-family="Arial, sans-serif" fill="${white}">${escapeText(options.label ?? "")}</text>`;
    }
  })();

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${PIN_MARKER_SIZE}" height="${PIN_MARKER_SIZE}" viewBox="0 0 32 32" role="img" aria-label="${style.label}">` +
    halo +
    shape +
    glyph +
    `</svg>`
  );
}

function escapeText(value: string | number): string {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** `Marker.icon.url` に渡す data URL */
export function pinIconDataUrl(type: AnyPinType, options: PinMarkerOptions = {}): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(pinIconSvgMarkup(type, options))}`;
}
