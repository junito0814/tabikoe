import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { existsSync, readFileSync } from "node:fs";
import { GoogleMapsAttribution } from "./GoogleMapsAttribution";

/**
 * 出典: #699 単体テスト
 *
 * 【初心者向け】ロゴは**作り直してはいけない**ので、見張るのは
 * ①公式の素材が実在すること ②明るい背景用と暗い背景用が出し分けられること
 * ③大きさの決まり（高さ 16〜19px）を守っていること。
 */
const LIGHT = "public/google-maps/google-maps-dark-gray.svg";
const DARK = "public/google-maps/google-maps-white.svg";

describe("GoogleMapsAttribution", () => {
  it("公式の素材が 2 つ入っている", () => {
    expect(existsSync(LIGHT)).toBe(true);
    expect(existsSync(DARK)).toBe(true);
  });

  it("明るい背景用は濃い灰色、暗い背景用は白（色を変えていない）", () => {
    expect(readFileSync(LIGHT, "utf8")).toContain("#1F1F1F");
    expect(readFileSync(DARK, "utf8")).toContain("#FFFFFF");
  });

  it("配色設定で出し分ける", () => {
    const { container } = render(<GoogleMapsAttribution />);
    const source = container.querySelector("source");
    expect(source).toHaveAttribute("media", "(prefers-color-scheme: dark)");
    expect(source).toHaveAttribute("srcset", "/google-maps/google-maps-white.svg");
  });

  it("既定は明るい背景用で、高さは決まりの範囲（16〜19px）", () => {
    const { container } = render(<GoogleMapsAttribution />);
    const img = container.querySelector("img")!;
    expect(img).toHaveAttribute("src", "/google-maps/google-maps-dark-gray.svg");
    expect(img).toHaveAttribute("alt", "Google マップ");
    expect(img).toHaveClass("h-[18px]");
  });
});
