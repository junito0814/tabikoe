import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { BackLink } from "./BackLink";

/**
 * 出典: #686（バッジ・アルバムに戻るボタンが無い）単体テスト
 * 要件定義書 4.5.13・ワイヤーフレーム決定事項 80
 */
describe("BackLink", () => {
  it("既定ではマイページへ戻る", () => {
    render(<BackLink />);
    expect(screen.getByRole("link", { name: "マイページ" })).toHaveAttribute("href", "/mypage");
  });

  it("戻り先の画面名を出せる", () => {
    render(<BackLink href="/albums" label="アルバム一覧" />);
    expect(screen.getByRole("link", { name: "アルバム一覧" })).toHaveAttribute("href", "/albums");
  });
});

/**
 * 【初心者向け】写しを作らせないための見張り。戻るの形が 2 か所に書かれると、
 * 片方だけ直してズレる（約束 14）。この部品を使っているかをファイルの中身で見る。
 */
describe("戻るを置く 3 画面は、この部品を使う", () => {
  const read = (p: string) => readFileSync(p, "utf8");

  it("行きたい・バッジ・アルバム一覧の 3 つ", () => {
    for (const path of [
      "src/components/wishlist/WishlistScreen.tsx",
      "src/components/badges/BadgeScreen.tsx",
      "src/app/albums/page.tsx",
    ]) {
      expect(read(path), `${path} が BackLink を使っていない`).toContain("<BackLink");
    }
  });
});
