import { createElement } from "react";
import { resolvePinLook, type AnyPinType, type PinLookInput } from "./pin-styles";
import { buildBadgeElements, buildGlyphElements, buildPinElements, type PinElement } from "./pin-shapes";
import type { PostCategory } from "@/lib/posts/constants";

/**
 * pin-display-rules-v3 Task1 / pin-categories Task1（2026-09-26）: 画面の中で使うピン
 * 出典: docs/tasks/shared-ui/pin-categories/01-teardrop-and-category-icons.md
 *
 * 【初心者向け】凡例や一覧で使う React 版のピン。図形は pin-shapes.ts が決めるので、ここは
 * その結果を React の要素に変えるだけ。色は CSS 変数（var(--pin-food) など）をそのまま使うので、
 * ダークモードでは自動で切り替わる。地図のマーカー用は pin-marker-icon.ts が同じ図形を文字列で組む。
 */
export function PinIcon({
  type,
  size = 32,
  label,
  dayIndex,
  done,
  category,
}: {
  type: AnyPinType;
  size?: number;
  /** numbered / cluster の中に出す文字 */
  label?: string | number;
  dayIndex?: number | null;
  done?: boolean;
  /** そのスポットのカテゴリ（色と記号を決める） */
  category?: PostCategory | null;
}) {
  const input: PinLookInput = { category, dayIndex, done, label };
  const look = resolvePinLook(type, input);
  const white = "var(--surface)";
  const fill = "token" in look.color ? `var(--${look.color.token})` : look.color.value;

  const elements = [
    ...buildPinElements(look, { fill, white }),
    ...buildGlyphElements(look, { fill, white }, label),
    ...buildBadgeElements(look, { saved: "var(--saved)", done: "var(--done)", white }),
  ];

  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label={look.label}>
      {elements.map((element, index) => toReact(element, index))}
    </svg>
  );
}

/** pin-shapes.ts の要素（タグと属性）を React の要素にする */
function toReact(element: PinElement, key: number) {
  const props: Record<string, unknown> = { key };
  for (const [name, value] of Object.entries(element.attrs)) {
    // SVG の属性名（stroke-width）は React では camelCase（strokeWidth）
    props[name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())] = value;
  }
  return createElement(element.tag, props, element.text);
}
