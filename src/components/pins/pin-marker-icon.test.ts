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
const ALL_TYPES: PinType[] = ["post", "saved", "posted", "draft", "focus", "numbered", "cluster"];

/** 属性の並び・xmlns の有無に依らず比較できるよう、要素と属性の集合に正規化する */
function normalize(svg: string): string[] {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  return Array.from(doc.documentElement.querySelectorAll("*")).map((element) => {
    // 色は React 版が CSS 変数、マーカー版が解決済みの 16 進なので比較から外す
    const attrs = Array.from(element.attributes)
      .filter((attr) => !["fill", "stroke"].includes(attr.name))
      .map((attr) => `${attr.name}=${attr.value}`)
      .sort()
      .join(" ");
    return `${element.tagName} ${attrs}`;
  });
}

describe("pinIconSvgMarkup", () => {
  it.each(ALL_TYPES)("%s の図形が PinIcon と一致する", (type) => {
    const fromReact = renderToStaticMarkup(createElement(PinIcon, { type, label: 3, dayIndex: 2 }));
    expect(normalize(pinIconSvgMarkup(type, { label: 3, dayIndex: 2 }))).toEqual(normalize(fromReact));
  });

  it("data URL としてエンコードされる", () => {
    expect(pinIconDataUrl("post")).toMatch(/^data:image\/svg\+xml;charset=UTF-8,%3Csvg/);
  });
});

describe("色の解決（pin-display-rules-v3 Task1）", () => {
  it("getComputedStyle が値を返さない環境ではライトの既定色を埋め込む", () => {
    expect(pinIconSvgMarkup("post")).toContain("#2f7fd8");
    expect(pinIconSvgMarkup("saved")).toContain("#d9414a");
  });
  it("旧種別名（normal / wishlist）も描ける", () => {
    expect(pinIconSvgMarkup("normal")).toContain("#2f7fd8");
    expect(pinIconSvgMarkup("wishlist")).toContain("#d9414a");
  });
  it("番号ピンは済みで灰色になる", () => {
    expect(pinIconSvgMarkup("numbered", { label: 1, dayIndex: 1, done: true })).toContain("#7b8794");
  });
});
