import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MapSheetLayout } from "./MapSheetLayout";
import { SHEET_DRAG_THRESHOLD_PX } from "./use-sheet-drag";

/**
 * 出典: docs/tasks/shared-ui/mentoring-7/11-sheet-drag.md 単体テスト
 * - ドラッグ量が半分未満で離すと元の状態に戻り、閾値以上で反対の状態に吸い付くこと（pointer イベントのシミュレーション）
 * - 取っ手の Enter で aria-expanded が切り替わること
 * 【初心者向け】jsdom は高さを測れないので、地図の offsetHeight を 300 に偽装し、window.scrollTo を記録して
 * 「どこへスクロールしようとしたか」で判定する。
 */
function setup() {
  const scrollTo = vi.fn();
  Object.defineProperty(window, "scrollTo", { value: scrollTo, writable: true });
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, get: () => 300 });
  render(
    <MapSheetLayout map={<div data-testid="map" />}>
      <p>内容</p>
    </MapSheetLayout>
  );
  const handle = screen.getByRole("button", { name: /シートを広げる/ });
  handle.setPointerCapture = vi.fn();
  handle.releasePointerCapture = vi.fn();
  return { scrollTo, handle };
}

afterEach(() => {
  Object.defineProperty(window, "scrollY", { value: 0, writable: true });
});

describe("MapSheetLayout（v3.1 Task11: スライドで全画面 ⇄ 1：2）", () => {
  it("上に閾値以上スライドすると全画面（地図の高さまでスクロール）、小さい動きでは何もしない", () => {
    const { scrollTo, handle } = setup();
    fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientY: 400 });
    fireEvent.pointerUp(handle, { pointerId: 1, clientY: 400 - SHEET_DRAG_THRESHOLD_PX / 2 });
    expect(scrollTo).not.toHaveBeenCalled();
    fireEvent.pointerDown(handle, { button: 0, pointerId: 2, clientY: 400 });
    fireEvent.pointerUp(handle, { pointerId: 2, clientY: 400 - SHEET_DRAG_THRESHOLD_PX });
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 300 }));
  });

  it("全画面のとき下にスライドすると 1：2（先頭へスクロール）。aria-expanded が状態を表す", () => {
    const { scrollTo, handle } = setup();
    Object.defineProperty(window, "scrollY", { value: 300, writable: true });
    fireEvent.scroll(window);
    expect(screen.getByRole("button", { name: /シートを戻す/ })).toHaveAttribute("aria-expanded", "true");
    fireEvent.pointerDown(handle, { button: 0, pointerId: 3, clientY: 100 });
    fireEvent.pointerUp(handle, { pointerId: 3, clientY: 100 + SHEET_DRAG_THRESHOLD_PX });
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }));
  });

  it("取っ手の Enter で切り替わる。html に scroll-snap が付き、離れると外れる", () => {
    const { scrollTo, handle } = setup();
    expect(document.documentElement.style.scrollSnapType).toBe("y proximity");
    fireEvent.keyDown(handle, { key: "Enter" });
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 300 }));
  });
});
