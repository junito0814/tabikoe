import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import manifest from "./manifest";
import { BRAND_GROUND } from "@/lib/theme/colors";

/** 出典: docs/tasks/shared-ui/loading-feedback/01-app-shell-color.md 単体テスト */
describe("manifest", () => {
  it("起動直後の下地をロゴの地の青にする（白い一瞬を出さない）", () => {
    const m = manifest();
    expect(m.background_color).toBe(BRAND_GROUND);
    expect(m.theme_color).toBe(BRAND_GROUND);
  });

  it("ホーム画面から単独のアプリとして開き、ホーム（/）から始まる", () => {
    const m = manifest();
    expect(m.display).toBe("standalone");
    expect(m.start_url).toBe("/");
  });

  it("名前と説明が要件のキャッチフレーズと揃っている", () => {
    const m = manifest();
    expect(m.name).toBe("タビコエ");
    expect(m.short_name).toBe("タビコエ");
    expect(m.description).toBe("あなたのコエが、だれかのタビへ。");
  });

  it("参照しているアイコンが実在する（配信元は Next.js のファイル規約）", () => {
    const paths: Record<string, string> = {
      "/icon.svg": "src/app/icon.svg",
      "/apple-icon.png": "src/app/apple-icon.png",
    };
    const icons = manifest().icons ?? [];
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) {
      const file = paths[icon.src];
      expect(file, `${icon.src} の配信元が分からない`).toBeTruthy();
      expect(existsSync(file)).toBe(true);
    }
  });
});
