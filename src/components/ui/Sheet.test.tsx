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

  it("Bug #473: シートはメニューバー（z-40）より上の z-50 に出る", () => {
    render(
      <Sheet open title="保存先" onClose={vi.fn()}>
        中身
      </Sheet>
    );
    expect(document.querySelector("[data-sheet]")).toHaveClass("z-50");
  });
});
