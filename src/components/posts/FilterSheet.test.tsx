import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { FilterSheet } from "./FilterSheet";
import { EMPTY_SEARCH_STATE } from "./post-search-query";

/**
 * 出典: docs/tasks/map-search/post-timeline/02-timeline-ui.md（絞り込みシート）
 * - 「この条件で表示」で編集中の条件が親に渡る
 * - Bug #473: シートはメニューバー（z-40）より上（z-50）に出て、下端のボタンが隠れない
 * 出典: docs/tasks/map-search/explore-mode/05-filter-toggle.md（2026-10-03）
 * - 「指定なし」を置かず、もう一度押すと解除する（要件 3.4.2「絞り込みの選び方」）
 */
describe("FilterSheet（絞り込みシート）", () => {
  it("カテゴリを選んで「この条件で表示」を押すと、その条件が onApply に渡る", () => {
    const onApply = vi.fn();
    render(<FilterSheet open value={EMPTY_SEARCH_STATE} hasDistanceCenter={false} onApply={onApply} onClose={vi.fn()} />);
    fireEvent.click(screen.getByLabelText("グルメ"));
    fireEvent.click(screen.getByRole("button", { name: "この条件で表示" }));
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ categories: ["グルメ"] }));
  });

  it("Bug #473: シートは body 直下（上 1/3 地図＋シートの枠の外）に z-50 で出て、メニューバー（z-40）に隠れない。メニューバーは隠さず残す", () => {
    const { container } = render(
      <div className="relative z-10">
        <FilterSheet open value={EMPTY_SEARCH_STATE} hasDistanceCenter={false} onApply={vi.fn()} onClose={vi.fn()} />
      </div>
    );
    const sheet = document.querySelector("[data-filter-sheet]") as HTMLElement;
    expect(sheet).toHaveClass("z-50");
    expect(sheet.parentElement).toBe(document.body);
    // メニューバーは隠さない: バーがあるときはスマホで下 60px（パソコンで左 200px）を空ける
    expect(sheet).toHaveClass("[body:has([data-menu-bar])_&]:bottom-[60px]");
    expect(container.querySelector("[data-filter-sheet]")).toBeNull();
  });

  it("閉じているときは何も描画しない", () => {
    render(<FilterSheet open={false} value={EMPTY_SEARCH_STATE} hasDistanceCenter={false} onApply={vi.fn()} onClose={vi.fn()} />);
    expect(document.querySelector("[data-filter-sheet]")).toBeNull();
  });
});

/*
 * explore-mode Task 5（2026-10-03）: 絞り込みの選び方
 * 出典: docs/tasks/map-search/explore-mode/05-filter-toggle.md
 *       要件定義書 3.4.2「絞り込みの選び方」・3.4.6「選び方」
 */
describe("絞り込みの選び方（explore-mode Task 5）", () => {
  /** 地図（探すモード）で使う形。評価が増える */
  const SPOT_VALUE = { categories: [] as string[], cost: null, duration: null, rating: null };

  it("投稿一覧に「指定なし」を出さない", () => {
    render(<FilterSheet open value={EMPTY_SEARCH_STATE} hasDistanceCenter onApply={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByLabelText("指定なし")).toBeNull();
    expect((document.querySelector("[data-filter-sheet] form") as HTMLElement).textContent).not.toContain("指定なし");
  });

  it("地図（探すモード）にも「指定なし」を出さない", () => {
    render(<FilterSheet open value={SPOT_VALUE} hasDistanceCenter={false} variant="spots" onApply={vi.fn()} onClose={vi.fn()} />);
    expect((document.querySelector("[data-filter-sheet] form") as HTMLElement).textContent).not.toContain("指定なし");
  });

  it("選んだものをもう一度押すと解除される（予算・滞在時間）", () => {
    const onApply = vi.fn();
    render(<FilterSheet open value={EMPTY_SEARCH_STATE} hasDistanceCenter={false} onApply={onApply} onClose={vi.fn()} />);
    // 1 回目で選ばれ、2 回目で外れる
    fireEvent.click(screen.getByLabelText("〜3,000円"));
    expect(screen.getByLabelText("〜3,000円")).toBeChecked();
    fireEvent.click(screen.getByLabelText("〜3,000円"));
    expect(screen.getByLabelText("〜3,000円")).not.toBeChecked();

    fireEvent.click(screen.getByLabelText("半日"));
    fireEvent.click(screen.getByLabelText("半日"));
    fireEvent.click(screen.getByRole("button", { name: "この条件で表示" }));
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ cost: null, duration: null }));
  });

  it("別のものを押すと乗り換わる（2 つ同時に選ばれない）", () => {
    const onApply = vi.fn();
    render(<FilterSheet open value={EMPTY_SEARCH_STATE} hasDistanceCenter={false} onApply={onApply} onClose={vi.fn()} />);
    fireEvent.click(screen.getByLabelText("〜1,000円"));
    fireEvent.click(screen.getByLabelText("〜5,000円"));
    expect(screen.getByLabelText("〜1,000円")).not.toBeChecked();
    expect(screen.getByLabelText("〜5,000円")).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "この条件で表示" }));
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ cost: "5000" }));
  });

  it("地図の評価も、もう一度押すと解除される", () => {
    const onApply = vi.fn();
    render(<FilterSheet open value={SPOT_VALUE} hasDistanceCenter={false} variant="spots" onApply={onApply} onClose={vi.fn()} />);
    fireEvent.click(screen.getByLabelText("★4 以上"));
    fireEvent.click(screen.getByLabelText("★5"));
    expect(screen.getByLabelText("★4 以上")).not.toBeChecked();
    fireEvent.click(screen.getByLabelText("★5"));
    fireEvent.click(screen.getByRole("button", { name: "この条件で表示" }));
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ rating: null }));
  });

  it("カテゴリは今までどおり複数選べる", () => {
    const onApply = vi.fn();
    render(<FilterSheet open value={EMPTY_SEARCH_STATE} hasDistanceCenter={false} onApply={onApply} onClose={vi.fn()} />);
    fireEvent.click(screen.getByLabelText("グルメ"));
    fireEvent.click(screen.getByLabelText("宿泊施設"));
    fireEvent.click(screen.getByRole("button", { name: "この条件で表示" }));
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ categories: ["グルメ", "宿泊施設"] }));
  });

  it("「条件をクリア」で全部やめられる（並び替えは残る）", () => {
    const onApply = vi.fn();
    render(
      <FilterSheet
        open
        value={{ ...EMPTY_SEARCH_STATE, sort: "rating" as const }}
        hasDistanceCenter
        onApply={onApply}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByLabelText("〜1,000円"));
    fireEvent.click(screen.getByLabelText("グルメ"));
    fireEvent.click(screen.getByLabelText("1km以内"));
    fireEvent.click(screen.getByRole("button", { name: "条件をクリア" }));
    fireEvent.click(screen.getByRole("button", { name: "この条件で表示" }));
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ cost: null, categories: [], distance: null, sort: "rating" }));
  });
});

/**
 * #680（2026-10-05）: 「タビコエだけの場所」は概念ごと廃止（決定事項 70）。
 * 絞り込みは 地図＝カテゴリ・予算・滞在時間・評価、投稿一覧＝予算・期間・カテゴリ・滞在時間・距離。
 */
describe("#680: 「タビコエだけの場所」は出さない", () => {
  const SPOT_VALUE = { categories: [] as string[], cost: null, duration: null, rating: null };

  it("投稿一覧にも地図にも、その行が無い", () => {
    const { unmount } = render(<FilterSheet open value={EMPTY_SEARCH_STATE} hasDistanceCenter={false} onApply={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByText("タビコエだけの場所")).toBeNull();
    unmount();

    render(<FilterSheet open variant="spots" value={SPOT_VALUE} hasDistanceCenter={false} onApply={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByText("タビコエだけの場所")).toBeNull();
  });
});
