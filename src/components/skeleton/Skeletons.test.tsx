import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CardListSkeleton, CommentsSkeleton, ListScreenSkeleton, MapSheetSkeleton, TopBarSkeleton } from "./Skeletons";

/**
 * 出典: docs/tasks/shared-ui/performance/02-streaming.md 単体テスト
 * - 骨組みは「読み込んでいます」の status を持ち、分かっている見出し・戻り先は文字で出す
 */
describe("Skeletons（読み込み中の骨組み）", () => {
  it("一覧の骨組みは status と指定枚数のカードの枠を出す", () => {
    render(<CardListSkeleton count={4} />);
    const status = screen.getByRole("status", { name: "読み込んでいます" });
    expect(status.children).toHaveLength(4);
  });

  it("上部の帯は戻り先とタイトルが分かっていれば文字で出す", () => {
    render(<TopBarSkeleton backLabel="東京都" title="浅草寺" />);
    expect(screen.getByText("東京都")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "浅草寺" })).toBeInTheDocument();
  });

  it("画面の骨組み（一覧・上 1/3 地図）とコメントの枠が描ける", () => {
    const { unmount } = render(<ListScreenSkeleton title="行きたい" />);
    expect(screen.getByRole("heading", { name: "行きたい" })).toBeInTheDocument();
    unmount();
    render(
      <MapSheetSkeleton backLabel="地図">
        <CommentsSkeleton />
      </MapSheetSkeleton>
    );
    expect(screen.getByRole("status", { name: "コメントを読み込んでいます" })).toBeInTheDocument();
  });
});
