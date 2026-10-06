import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { MapOverlayControls } from "./MapOverlayControls";

/**
 * 出典: Issue #760「アプリ全体の地図ボタンを記号にそろえる」
 *       Issue #764「Bug 4: 上 1/3 の地図で Google のロゴがシートに半分隠れる」
 */
describe("MapOverlayControls（#760）", () => {
  it("「全画面に」は記号だけ。読み上げでは「地図を全画面に」と読まれる", () => {
    render(<MapOverlayControls fullscreenHref="/map?spot=s1" moved={false} onReset={vi.fn()} />);
    const link = screen.getByRole("link", { name: "地図を全画面に" });
    expect(link.textContent?.trim()).toBe(""); // 文字は入っていない
    expect(link.querySelector("svg")).toBeInTheDocument();
  });

  it("行き先は今までどおり（渡された URL のまま）", () => {
    render(<MapOverlayControls fullscreenHref="/map?itinerary=it-1&day=1" moved={false} onReset={vi.fn()} />);
    expect(screen.getByRole("link", { name: "地図を全画面に" })).toHaveAttribute("href", "/map?itinerary=it-1&day=1");
  });

  it("指で押す的は 32px 以上（記号にすると小さくなりやすいので明示する）", () => {
    render(<MapOverlayControls fullscreenHref="/map" moved={false} onReset={vi.fn()} />);
    const link = screen.getByRole("link", { name: "地図を全画面に" });
    expect(link.className).toContain("h-8");
    expect(link.className).toContain("w-8");
  });

  it("「戻す」は地図を動かしたときだけ出て、文字のまま（記号にすると何が戻るか分からない）", () => {
    const onReset = vi.fn();
    const { rerender } = render(<MapOverlayControls fullscreenHref="/map" moved={false} onReset={onReset} />);
    expect(screen.queryByRole("button", { name: "戻す" })).toBeNull();
    rerender(<MapOverlayControls fullscreenHref="/map" moved onReset={onReset} />);
    fireEvent.click(screen.getByRole("button", { name: "戻す" }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});

/**
 * 【初心者向け】2 つの地図にまったく同じ塊が書かれていたので 1 つにまとめた（約束 14）。
 * また写しが生えないよう、両方がこの部品を使っていることを確かめる。
 */
describe("2 つの地図が同じ部品を使う（#760）", () => {
  const read = (path: string) => readFileSync(path, "utf8");

  it("StaticSpotMap と ItineraryStaticMap のどちらも使っている", () => {
    for (const path of ["src/components/map/StaticSpotMap.tsx", "src/components/map/ItineraryStaticMap.tsx"]) {
      expect(read(path), `${path} が MapOverlayControls を使っていない`).toContain("<MapOverlayControls");
      // 文字の「地図を全画面に」を自前で書いていない
      expect(read(path)).not.toContain(">\n          地図を全画面に");
    }
  });

  it("#764: どちらの地図も Google のロゴをシートから逃がす余白を持つ", () => {
    for (const path of ["src/components/map/StaticSpotMap.tsx", "src/components/map/ItineraryStaticMap.tsx"]) {
      expect(read(path), `${path} に LOGO_SAFE_CLASS が無い`).toContain("LOGO_SAFE_CLASS");
    }
  });
});
