import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { BadgeToast } from "./BadgeToast";
import { buildPostedHref, buildUpdatedHref, parseBadgeToastParam } from "./badge-toast-params";

/**
 * 出典: docs/tasks/badges/status-badges/05-badge-toast-notification.md 単体テスト
 * - 新規獲得バッジが0件の場合、トーストが表示されないこと
 * - 新規獲得バッジが複数件の場合、すべて表示されること
 */
describe("BadgeToast", () => {
  it("新規獲得が0件なら何も表示しない", () => {
    render(<BadgeToast badgeTypes={[]} autoDismissMs={0} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("複数件は1枚のトーストにまとめて全件表示する", () => {
    render(
      <BadgeToast badgeTypes={["post_count:1", "prefecture:東京都", "post_count:10"]} autoDismissMs={0} />
    );
    expect(screen.getByRole("status")).toHaveTextContent("3個のバッジを獲得しました");
    expect(screen.getByText("投稿1 件")).toBeInTheDocument();
    expect(screen.getByText("東京都")).toBeInTheDocument();
    expect(screen.getByText("投稿10 件")).toBeInTheDocument();
  });

  it("カタログに無い badge_type だけなら表示しない", () => {
    render(<BadgeToast badgeTypes={["unknown:1"]} autoDismissMs={0} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("閉じるボタンで消える", () => {
    render(<BadgeToast badgeTypes={["post_count:1"]} autoDismissMs={0} />);
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("バッジの受け渡し（URLクエリ）", () => {
  it("獲得なしなら posted=1 だけ", () => {
    expect(buildPostedHref([])).toBe("/map?posted=1");
  });

  it("編集後も同じ形式で updated=1 に載せる（#251）", () => {
    expect(buildUpdatedHref([])).toBe("/map?updated=1");
    expect(buildUpdatedHref(["prefecture:大阪府"])).toBe(`/map?updated=1&badges=${encodeURIComponent("prefecture:大阪府")}`);
  });

  it("獲得ありなら badges にカンマ区切りで載せ、復元できる", () => {
    const href = buildPostedHref(["post_count:1", "prefecture:東京都"]);
    const value = new URL(href, "http://localhost").searchParams.get("badges");
    expect(parseBadgeToastParam(value)).toEqual(["post_count:1", "prefecture:東京都"]);
  });

  it("カタログに無い値は捨てる", () => {
    expect(parseBadgeToastParam("post_count:1,evil:1,,")).toEqual(["post_count:1"]);
    expect(parseBadgeToastParam(undefined)).toEqual([]);
  });
});

/**
 * #972 Bug 2: バッジ獲得の知らせ → バッジ画面 → 戻る で、知らせが出ていた画面に帰れなかった。
 *
 * 【初心者向け】起きるのはバッジを取った直後だけだが、**そこが見せ場**。
 * 投稿した直後に喜んで押した人が、自分の新しい投稿に帰れないのは惜しい。
 */
describe("バッジ一覧へのリンクが、知らせが出ていた画面を渡す（#972）", () => {
  it("backHref を渡すと ?back= が付く", () => {
    render(<BadgeToast badgeTypes={["prefecture:東京都"]} autoDismissMs={0} backHref="/posts/p1?back=%2Fsearch" />);
    const link = screen.getByRole("link", { name: "バッジ一覧を見る" });
    expect(link.getAttribute("href")).toBe("/badges?back=%2Fposts%2Fp1%3Fback%3D%252Fsearch");
  });

  it("渡さなければ今までどおり /badges のまま", () => {
    render(<BadgeToast badgeTypes={["prefecture:東京都"]} autoDismissMs={0} />);
    expect(screen.getByRole("link", { name: "バッジ一覧を見る" }).getAttribute("href")).toBe("/badges");
  });
});
