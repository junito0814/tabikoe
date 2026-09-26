import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MapSheetLayout } from "./MapSheetLayout";
import { SHEET_DRAG_THRESHOLD_PX } from "./use-sheet-drag";

/**
 * 出典: docs/tasks/shared-ui/mentoring-7/11-sheet-drag.md 単体テスト
 * - ドラッグ量が半分未満で離すと元の状態に戻り、閾値以上で反対の状態に吸い付くこと（pointer イベントのシミュレーション）
 * - 取っ手の Enter で aria-expanded が切り替わること
 * 出典: docs/tasks/shared-ui/map-sheet/02-three-step-sheet.md 単体テスト
 * - 3 段階の吸い付き（近い段階へ／いちばん下からさらに下へは縮まない）
 * - 取っ手のキーボード操作で段階が進み、いちばん上の次は既定に戻ること
 * - steps を 2 段階にすると、地図を広くする段階が無いこと（SC-03）
 * - 地図を広くしたときに summary が見え、既定に戻すと本文が見えること
 *
 * 【初心者向け】jsdom は高さを測れないので、地図の offsetHeight を 300 に偽装し、window.scrollTo を記録して
 * 「どこへスクロールしようとしたか」で判定する。地図を広くする段階だけは React の状態なので、
 * data-sheet-step（map / default / full）で見る。
 */
/**
 * 【初心者向け】jsdom の `offsetHeight` は常に 0 なので、ここでは HTMLElement 全体の定義を
 * 一時的に書き換えて 300 を返させる。**全部のテストに影響する書き換えなので、必ず元に戻す**
 * （戻さずに放置したら、実行の順番によって他のテストが落ちることがあった。2026-09-26）。
 */
const originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");
const originalScrollTo = Object.getOwnPropertyDescriptor(window, "scrollTo");

function setup({ steps, summary }: { steps?: 2 | 3; summary?: boolean } = {}) {
  const scrollTo = vi.fn();
  Object.defineProperty(window, "scrollTo", { value: scrollTo, writable: true, configurable: true });
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, get: () => 300 });
  render(
    <MapSheetLayout map={<div data-testid="map" />} steps={steps} summary={summary ? <span>見出しの 1 行</span> : undefined}>
      <p>内容</p>
    </MapSheetLayout>
  );
  const handle = screen.getByRole("button", { name: /シートを/ });
  handle.setPointerCapture = vi.fn();
  handle.releasePointerCapture = vi.fn();
  return { scrollTo, handle };
}

/** 取っ手を上下にスライドする。up なら上へ、down なら下へ閾値ぶん動かす */
let pointerId = 0;
function drag(handle: HTMLElement, direction: "up" | "down") {
  const id = ++pointerId;
  const move = direction === "up" ? -SHEET_DRAG_THRESHOLD_PX : SHEET_DRAG_THRESHOLD_PX;
  fireEvent.pointerDown(handle, { button: 0, pointerId: id, clientY: 400 });
  fireEvent.pointerUp(handle, { pointerId: id, clientY: 400 + move });
}

const step = () => document.querySelector("[data-map-sheet-layout]")?.getAttribute("data-sheet-step");

afterEach(() => {
  Object.defineProperty(window, "scrollY", { value: 0, writable: true, configurable: true });
  // 書き換えた定義を元に戻す（元々無かったものは消す）
  if (originalOffsetHeight) Object.defineProperty(HTMLElement.prototype, "offsetHeight", originalOffsetHeight);
  else delete (HTMLElement.prototype as unknown as Record<string, unknown>).offsetHeight;
  if (originalScrollTo) Object.defineProperty(window, "scrollTo", originalScrollTo);
  else delete (window as unknown as Record<string, unknown>).scrollTo;
});

describe("MapSheetLayout（v3.1 Task11: スライド／map-sheet Task2: 3 段階）", () => {
  it("上に閾値以上スライドすると全画面（地図の高さまでスクロール）、小さい動きでは何もしない", () => {
    const { scrollTo, handle } = setup();
    fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientY: 400 });
    fireEvent.pointerUp(handle, { pointerId: 1, clientY: 400 - SHEET_DRAG_THRESHOLD_PX / 2 });
    expect(scrollTo).not.toHaveBeenCalled();
    drag(handle, "up");
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 300 }));
  });

  it("全画面のとき下にスライドすると 1：2（先頭へスクロール）。aria-expanded が状態を表す", () => {
    const { scrollTo, handle } = setup();
    Object.defineProperty(window, "scrollY", { value: 300, writable: true });
    fireEvent.scroll(window);
    expect(step()).toBe("full");
    expect(screen.getByRole("button", { name: /シートを戻す/ })).toHaveAttribute("aria-expanded", "true");
    drag(handle, "down");
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }));
  });

  it("既定から下にスライドすると地図が 2/3 になり、そこからさらに下へは縮まない", () => {
    const { handle } = setup();
    expect(step()).toBe("default");
    drag(handle, "down");
    expect(step()).toBe("map");
    expect(document.querySelector('[data-map-sheet-layout] .h-\\[66dvh\\]')).not.toBeNull();
    // いちばん下なので、もう一度下にスライドしても変わらない
    drag(handle, "down");
    expect(step()).toBe("map");
  });

  it("地図 2/3 から上にスライドすると、いきなり全画面ではなく既定に戻る（1 段階ずつ）", () => {
    const { scrollTo, handle } = setup();
    drag(handle, "down");
    expect(step()).toBe("map");
    drag(handle, "up");
    expect(step()).toBe("default");
    expect(scrollTo).not.toHaveBeenCalled(); // まだ全画面にはしない
    drag(handle, "up");
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 300 }));
  });

  it("取っ手の Enter で段階が進み、いちばん上（全画面）の次は既定に戻る。html に scroll-snap が付く", () => {
    const { scrollTo, handle } = setup();
    expect(document.documentElement.style.scrollSnapType).toBe("y proximity");
    fireEvent.keyDown(handle, { key: "Enter" });
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 300 }));
    // 全画面になったことにして、もう一度押すと既定へ
    Object.defineProperty(window, "scrollY", { value: 300, writable: true });
    fireEvent.scroll(window);
    fireEvent.keyDown(handle, { key: "Enter" });
    expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ top: 0 }));
  });

  it("steps が 2 なら地図を広くする段階は無い（SC-03）", () => {
    const { handle } = setup({ steps: 2 });
    drag(handle, "down");
    expect(step()).toBe("default");
  });

  it("地図を広くすると見出しの 1 行だけになり、既定に戻すと本文が見える", () => {
    const { handle } = setup({ summary: true });
    expect(screen.getByText("内容")).toBeInTheDocument();
    drag(handle, "down");
    expect(screen.getByText("見出しの 1 行")).toBeInTheDocument();
    expect(screen.queryByText("内容")).toBeNull();
    drag(handle, "up");
    expect(screen.getByText("内容")).toBeInTheDocument();
    expect(screen.queryByText("見出しの 1 行")).toBeNull();
  });
});
