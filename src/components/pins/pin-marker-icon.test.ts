import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { PinIcon } from "./PinIcon";
import { pinIconDataUrl, pinIconSvgMarkup, pinMarkerAnchor } from "./pin-marker-icon";
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
    const options = { label: 3, dayIndex: 2, category: "グルメ" as const };
    const fromReact = renderToStaticMarkup(createElement(PinIcon, { type, ...options }));
    expect(normalize(pinIconSvgMarkup(type, options))).toEqual(normalize(fromReact));
  });

  it("data URL としてエンコードされる", () => {
    expect(pinIconDataUrl("post")).toMatch(/^data:image\/svg\+xml;charset=UTF-8,%3Csvg/);
  });
});

describe("色の解決（pin-categories Task1）", () => {
  it("getComputedStyle が値を返さない環境ではライトの既定色を埋め込む", () => {
    expect(pinIconSvgMarkup("post", { category: "グルメ" })).toContain("#e2703a");
    expect(pinIconSvgMarkup("post", { category: "宿泊施設" })).toContain("#9a6b33");
  });
  it("カテゴリが無ければ灰色", () => {
    expect(pinIconSvgMarkup("post")).toContain("#7b8794");
  });
  it("保存済みでも色はカテゴリのまま。赤はハートのバッジにだけ使う", () => {
    const svg = pinIconSvgMarkup("saved", { category: "グルメ" });
    expect(svg).toContain("#e2703a");
    expect(svg).toContain("#d9414a");
  });
  it("旧種別名（normal / wishlist）も描ける", () => {
    expect(pinIconSvgMarkup("normal", { category: "グルメ" })).toContain("#e2703a");
    expect(pinIconSvgMarkup("wishlist", { category: "グルメ" })).toContain("#e2703a");
  });
  it("番号ピンは済みで灰色になる", () => {
    expect(pinIconSvgMarkup("numbered", { label: 1, dayIndex: 1, done: true })).toContain("#7b8794");
  });
});

describe("座標を指す点（pin-categories Task1）", () => {
  it("しずく型は先端（下端）で指す", () => {
    expect(pinMarkerAnchor("post")).toEqual({ x: 16, y: 30.4 });
    expect(pinMarkerAnchor("numbered")).toEqual({ x: 16, y: 30.4 });
  });
  it("クラスタは丸なので中央で指す", () => {
    expect(pinMarkerAnchor("cluster")).toEqual({ x: 16, y: 16 });
  });
});
