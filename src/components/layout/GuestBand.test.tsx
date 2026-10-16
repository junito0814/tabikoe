import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { GuestBand } from "./GuestBand";
import { CATCHPHRASE } from "@/lib/terms";

/**
 * 出典: Issue #951、要件定義書 4.5.18「未ログインのときの画面」
 * - 文言は SC-00・SC-01 と同じキャッチフレーズ ＋「はじめる」
 * - 「ログインしてください」とは書かない
 * - 押すとログインへ行き、完了後に**同じ画面へ戻る**
 */
describe("GuestBand（#951 未ログインの帯）", () => {
  it("キャッチフレーズと「はじめる」を出し、戻り先を持ったログインへ行く", () => {
    render(<GuestBand returnTo="/posts/p1" />);
    expect(screen.getByText(CATCHPHRASE)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "はじめる" })).toHaveAttribute("href", "/login?redirect_to=%2Fposts%2Fp1");
  });

  it("「ログインしてください」とは書かない（見に来ただけの人を責めない）", () => {
    const { container } = render(<GuestBand returnTo="/spots/s1" />);
    expect(container.textContent).not.toContain("ログインしてください");
  });

  it("高さはメニューバーと同じ 60px（本文の下に空ける余白と合わせる）", () => {
    const { container } = render(<GuestBand returnTo="/spots/s1" />);
    const band = container.querySelector("[data-guest-band]") as HTMLElement;
    expect(band).toHaveClass("fixed", "bottom-0");
    expect(band.firstElementChild).toHaveClass("h-[60px]");
  });
});
