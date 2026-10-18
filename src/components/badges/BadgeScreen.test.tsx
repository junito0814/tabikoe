import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BadgeScreen } from "./BadgeScreen";
import { mergeBadgeStatus } from "@/lib/badges/badge-status";

/**
 * 出典: docs/tasks/badges/status-badges/04-badge-screen-ui.md（SC-10）
 * - 獲得済み・未獲得のバッジが一覧確認でき、描き分けられること
 */
describe("BadgeScreen", () => {
  it("獲得済みは獲得日つき、未獲得は「未獲得」で全63種を表示する（v3.2）", () => {
    const badges = mergeBadgeStatus([
      { badge_type: "post_count:1", acquired_at: "2026-09-01T03:00:00Z" },
    ]);
    render(<BadgeScreen badges={badges} />);

    expect(screen.getByText("1 / 63 個を獲得")).toBeInTheDocument();

    const acquired = screen.getByLabelText("投稿1 件（獲得済み）");
    expect(acquired).toHaveAttribute("data-acquired", "true");
    expect(acquired).toHaveTextContent("2026/9/1");

    const notYet = screen.getByLabelText("投稿10 件（未獲得）");
    expect(notYet).toHaveAttribute("data-acquired", "false");
    expect(notYet).toHaveTextContent("未獲得");

    expect(screen.getAllByRole("listitem")).toHaveLength(63);
  });

  /**
   * #686（2026-10-05）: ホーム画面から単独のアプリとして開くとブラウザの戻るが無く、
   * メニューバー以外に戻る手段が無くなっていた。要件 4.5.13 のとおり左上に置く。
   */
  it("左上に「マイページ」へ戻る導線がある", () => {
    render(<BadgeScreen badges={mergeBadgeStatus([])} />);
    expect(screen.getByRole("link", { name: "マイページ" })).toHaveAttribute("href", "/mypage");
  });

  it("都道府県セクションには未投稿の県も含めて47件並ぶ", () => {
    render(<BadgeScreen badges={mergeBadgeStatus([])} />);
    expect(screen.getByText("都道府県バッジ")).toBeInTheDocument();
    expect(screen.getByLabelText("北海道（未獲得）")).toBeInTheDocument();
    expect(screen.getByLabelText("沖縄県（未獲得）")).toBeInTheDocument();
  });
});

/**
 * #977: 都道府県だけ 🏅 を絵に替えた（要件 4.5.20・8 章 101）。
 *
 * 【初心者向け】ほかの 3 種類（投稿数・いいね数・スポット登録）は 🏅 のままです
 * （要件 4.5.14 で「残す」と決めたもの）。**替え忘れ・替えすぎ**の両方を押さえます。
 */
describe("都道府県バッジの絵（#977）", () => {
  it("都道府県の節には 🏅 が 1 つも出ない", () => {
    render(<BadgeScreen badges={mergeBadgeStatus([])} />);
    const tile = screen.getByLabelText("北海道（未獲得）");
    expect(tile.textContent).not.toContain("🏅");
    expect(tile.querySelector("svg")).not.toBeNull();
  });

  it("ほかの 3 種類には 🏅 が出る（絵に替えていない）", () => {
    render(<BadgeScreen badges={mergeBadgeStatus([])} />);
    for (const name of ["投稿1 件（未獲得）", "いいね1 件（未獲得）", "スポット登録1 件（未獲得）"]) {
      const tile = screen.getByLabelText(name);
      expect(tile.textContent, name).toContain("🏅");
      expect(tile.querySelector("svg"), name).toBeNull();
    }
  });

  it("未獲得は灰色にして薄める（絵でも 🏅 でも同じ見せ方）", () => {
    render(<BadgeScreen badges={mergeBadgeStatus([{ badge_type: "prefecture:北海道", acquired_at: "2026-10-14T00:00:00Z" }])} />);
    const acquired = screen.getByLabelText("北海道（獲得済み）");
    const notAcquired = screen.getByLabelText("青森県（未獲得）");
    expect(notAcquired.querySelector("[class*='grayscale']")).not.toBeNull();
    expect(acquired.querySelector("[class*='grayscale']")).toBeNull();
  });

  it("47 県すべてに絵が出る（1 県でも 🏅 に落ちていない）", () => {
    render(<BadgeScreen badges={mergeBadgeStatus([])} />);
    const section = screen.getByText("都道府県バッジ").closest("section")!;
    expect(section.querySelectorAll("li")).toHaveLength(47);
    expect(section.querySelectorAll("li svg")).toHaveLength(47);
  });
});

/**
 * #972 Bug 2: バッジ獲得の知らせから来たとき、戻るが決め打ちの「マイページ」になっていた。
 */
describe("戻るの行き先（#972）", () => {
  it("back を渡すと、その画面名とリンクになる", () => {
    render(<BadgeScreen badges={mergeBadgeStatus([])} back={{ href: "/posts/p1?back=%2Fsearch", label: "投稿" }} />);
    const link = screen.getByRole("link", { name: "投稿" });
    expect(link.getAttribute("href")).toBe("/posts/p1?back=%2Fsearch");
    expect(screen.queryByRole("link", { name: "マイページ" })).toBeNull();
  });

  it("渡さなければ今までどおりマイページに戻る", () => {
    render(<BadgeScreen badges={mergeBadgeStatus([])} />);
    expect(screen.getByRole("link", { name: "マイページ" }).getAttribute("href")).toBe("/mypage");
  });
});
