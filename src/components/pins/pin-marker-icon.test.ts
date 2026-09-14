import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { PinIcon } from "./PinIcon";
import { pinIconDataUrl, pinIconSvgMarkup } from "./pin-marker-icon";
import type { PinType } from "./pin-styles";

/**
 * 出典: docs/tasks/map-search/map-display/04-pin-type-integration.md
 * shared-ui/pin-display-rules Task1 のアイコン定義（PinIcon）と、地図マーカー用の SVG 文字列が
 * 図形・色・記号で一致していることを確認する（定義の二重化による乖離を防ぐ）。
 */
const ALL_TYPES: PinType[] = ["normal", "wishlist", "posted"];

/** 属性の並び・xmlns の有無に依らず比較できるよう、要素と属性の集合に正規化する */
function normalize(svg: string): string[] {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  return Array.from(doc.documentElement.querySelectorAll("*")).map((element) => {
    const attrs = Array.from(element.attributes)
      .map((attr) => `${attr.name}=${attr.value}`)
      .sort()
      .join(" ");
    return `${element.tagName} ${attrs}`;
  });
}

describe("pinIconSvgMarkup", () => {
  it.each(ALL_TYPES)("%s の図形が PinIcon と一致する", (type) => {
    const fromReact = renderToStaticMarkup(createElement(PinIcon, { type }));
    expect(normalize(pinIconSvgMarkup(type))).toEqual(normalize(fromReact));
  });

  it("data URL としてエンコードされる", () => {
    expect(pinIconDataUrl("normal")).toMatch(/^data:image\/svg\+xml;charset=UTF-8,%3Csvg/);
  });
});
