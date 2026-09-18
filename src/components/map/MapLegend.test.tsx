/**
 * 出典: docs/tasks/shared-ui/pin-display-rules-v3/02-map-legend.md（単体テスト）
 * 「表示状態（通常／しおり）に応じて項目が切り替わること」
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MapLegend } from "./MapLegend";

describe("MapLegend", () => {
  it("通常は みんなの投稿・保存済み・下書き の 3 項目", () => {
    render(<MapLegend />);
    expect(screen.getAllByRole("listitem").map((el) => el.textContent)).toEqual(["みんなの投稿", "保存済み", "下書き"]);
  });
  it("しおり表示では Day の数だけ項目を出す", () => {
    render(<MapLegend mode="itinerary" dayCount={3} />);
    expect(screen.getAllByRole("listitem").map((el) => el.textContent?.replace(/^\d/, ""))).toEqual(["Day 1", "Day 2", "Day 3"]);
  });
});
