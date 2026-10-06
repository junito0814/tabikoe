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
