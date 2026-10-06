import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { BackChevron, BackLink } from "./BackLink";

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
 * #813（2026-10-06）: 2 つの見た目
 * 出典: Issue #813「戻るボタンを共通部品 BackLink に統一する（21 か所）」
 */
describe("2 つの見た目（#813）", () => {
  it("既定は薄い灰色の「‹ ラベル」", () => {
    render(<BackLink href="/albums" label="アルバム一覧" />);
    expect(screen.getByRole("link", { name: "アルバム一覧" }).className).toContain("text-muted");
  });

  it("地図の上（floating）は白い丸みの札に濃い文字＋影", () => {
    render(<BackLink href="/" label="ホーム" variant="floating" />);
    const link = screen.getByRole("link", { name: "ホーム" });
    expect(link.className).toContain("rounded-full");
    expect(link.className).toContain("bg-surface");
    expect(link.className).toContain("shadow-card");
  });

  it("行き先が決まっていないとき（ブラウザの戻る）はボタンになる", () => {
    const onClick = vi.fn();
    render(<BackLink label="戻る" onClick={onClick} />);
    const button = screen.getByRole("button", { name: "戻る" });
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("記号は 1 つの部品から描く（写しを作らない）", () => {
    const { container } = render(<BackChevron />);
    expect(container.querySelector("path")).toHaveAttribute("d", "M15 5l-7 7 7 7");
  });
});

/**
 * 【初心者向け】写しを作らせないための見張り。戻るの形が 2 か所に書かれると、
 * 片方だけ直してズレる（約束 14）。
 *
 * #813: 以前は「戻るを置く 3 画面」だけを見ていたが、実際には 11 ファイルが
 * 自前で ‹ や ← を描いていた。**自前で描いていないこと**そのものを見張る形に変える。
 */
describe("戻るは全部この部品から描く（#813）", () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.tsx$/.test(entry) && !/\.test\.tsx$/.test(entry)) files.push(path);
    }
  };
  walk("src/components");
  walk("src/app");

  it("戻るの記号（chevron の path）を自前で描いているファイルが無い", () => {
    const offenders = files.filter((path) => path !== "src/components/layout/BackLink.tsx" && readFileSync(path, "utf8").includes('d="M15 5l-7 7 7 7"'));
    expect(offenders).toEqual([]);
  });

  it("戻るを置く画面はこの部品を使う", () => {
    for (const path of [
      "src/components/wishlist/WishlistScreen.tsx",
      "src/components/badges/BadgeScreen.tsx",
      "src/app/albums/page.tsx",
      "src/components/albums/AlbumScreen.tsx",
      "src/components/itineraries/ItineraryDetailScreen.tsx",
      "src/components/map/MapScreen.tsx",
      "src/components/posts/PostDetailScreen.tsx",
      "src/components/posts/PostSearchScreen.tsx",
      "src/components/posts/SpotSearchScreen.tsx",
      "src/components/spots/SpotFixScreen.tsx",
      "src/components/legal/LegalDocumentScreen.tsx",
      "src/app/mypage/drafts/page.tsx",
    ]) {
      expect(readFileSync(path, "utf8"), `${path} が BackLink を使っていない`).toContain("<BackLink");
    }
  });
});
