import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AppLogo } from "./AppLogo";

/**
 * 出典: docs/tasks/shared-ui/brand-logo/02-app-logo-in-screens.md 単体テスト
 * - 画面のロゴが要件定義書 4.5.9 の数値どおりであること
 * - タブのアイコン（src/app/icon.svg）と形が同じであること（別々に直されて形がずれるのを防ぐ）
 */
describe("AppLogo（4.5.9）", () => {
  it("4.5.9 の数値で描かれる", () => {
    const { container } = render(<AppLogo />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("72");
    expect(svg.querySelector('rect[fill="#2F7FD8"]')).not.toBeNull(); // 地の空の青（ダークでも変えない）
    expect(svg.querySelector('circle[r="11.5"]')).not.toBeNull(); // 吹き出しの円
    expect(svg.querySelector('path[d="M32 42L36 51L40 42Z"]')).not.toBeNull(); // 下に伸びる尾
    expect(svg.querySelector('circle[r="22"]')).not.toBeNull(); // 内側の輪
    expect(svg.querySelector('circle[r="30"]')).not.toBeNull(); // 外側の輪
  });

  it("size を渡すと大きさだけが変わる", () => {
    const { container } = render(<AppLogo size={64} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("64");
    expect(svg.getAttribute("viewBox")).toBe("0 0 72 72"); // 中の形は変えない
  });

  it("タブのアイコン（icon.svg）と同じ形である", () => {
    const iconSvg = readFileSync(join(process.cwd(), "src", "app", "icon.svg"), "utf8");
    const { container } = render(<AppLogo />);
    for (const part of ['r="11.5"', 'd="M32 42L36 51L40 42Z"', 'r="22"', 'r="30"', '#2F7FD8']) {
      expect(iconSvg).toContain(part);
      expect(container.innerHTML).toContain(part);
    }
  });
});
