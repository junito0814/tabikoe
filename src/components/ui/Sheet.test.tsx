import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Sheet } from "./Sheet";

/**
 * 出典: docs/wireframes.md（保存先シート・期間の変更などの共通シート）
 * - 背景のタップと Esc で閉じる
 * - Bug #473: メニューバー（z-40）より上の z-50 に出て、フッターのボタンが隠れない
 */
describe("Sheet（共通シート）", () => {
  it("背景のタップと Esc で閉じる。footer を出す", () => {
    const onClose = vi.fn();
    render(
      <Sheet open title="保存先" onClose={onClose} footer={<button type="button">決定</button>}>
        中身
      </Sheet>
    );
    expect(screen.getByRole("dialog", { name: "保存先" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "決定" })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "閉じる" })[0]);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("Bug #473: シートは body 直下（上 1/3 地図＋シートの枠の外）に z-50 で出て、メニューバー（z-40）に隠れない。メニューバーは隠さず残す", () => {
    const { container } = render(
      <div className="relative z-10">
        <Sheet open title="保存先" onClose={vi.fn()}>
          中身
        </Sheet>
      </div>
    );
    const sheet = document.querySelector("[data-sheet]") as HTMLElement;
    expect(sheet).toHaveClass("z-50");
    expect(sheet.parentElement).toBe(document.body);
    // メニューバーは隠さない: バーがあるときはスマホで下 60px（パソコンで左 200px）を空ける
    expect(sheet).toHaveClass("[body:has([data-menu-bar])_&]:bottom-[60px]");
    expect(container.querySelector("[data-sheet]")).toBeNull();
  });
});
