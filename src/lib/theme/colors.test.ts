import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { APP_BACKGROUND, BRAND_GROUND } from "./colors";

/**
 * 出典: docs/tasks/shared-ui/loading-feedback/01-app-shell-color.md 単体テスト
 * ここの値は CSS から読めないので写している。写し間違いをこのテストで止める。
 */
const css = readFileSync("src/app/globals.css", "utf8");
const svg = readFileSync("src/app/icon.svg", "utf8");

/** globals.css から `--app` の値を取り出す。1 つ目がライト、2 つ目がダーク */
function appBackgrounds(): string[] {
  return [...css.matchAll(/--app:\s*(#[0-9a-fA-F]{3,8})\s*;/g)].map((m) => m[1].toLowerCase());
}

describe("APP_BACKGROUND", () => {
  it("globals.css の --app と一致している（ライト・ダーク）", () => {
    const [light, dark] = appBackgrounds();
    expect(light).toBe(APP_BACKGROUND.light.toLowerCase());
    expect(dark).toBe(APP_BACKGROUND.dark.toLowerCase());
  });

  it("ライトとダークで別の値になっている", () => {
    expect(APP_BACKGROUND.light).not.toBe(APP_BACKGROUND.dark);
  });
});

describe("BRAND_GROUND", () => {
  it("ロゴ（icon.svg）の地の色と一致している", () => {
    expect(svg).toContain(`fill="${BRAND_GROUND}"`);
  });
});
