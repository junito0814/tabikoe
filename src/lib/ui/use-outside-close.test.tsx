import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { useOutsideClose } from "./use-outside-close";

/**
 * #789 の単体テスト: 外をタップ／Esc で閉じる hook
 * 出典: Issue #789「時刻ピッカーが外をタップしても閉じず、他のメニューと重なる」
 */
function Sample({ onClose }: { onClose?: () => void } = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useOutsideClose<HTMLDivElement>(isOpen, () => {
    setIsOpen(false);
    onClose?.();
  });
  return (
    <div>
      <div ref={ref}>
        <button type="button" onClick={() => setIsOpen((open) => !open)}>
          開く
        </button>
        {isOpen && <p>中身</p>}
      </div>
      <button type="button">外のボタン</button>
    </div>
  );
}

const open = () => fireEvent.click(screen.getByRole("button", { name: "開く" }));

describe("useOutsideClose（#789）", () => {
  it("外を pointerdown すると閉じる", () => {
    render(<Sample />);
    open();
    expect(screen.getByText("中身")).toBeInTheDocument();
    fireEvent.pointerDown(screen.getByRole("button", { name: "外のボタン" }));
    expect(screen.queryByText("中身")).toBeNull();
  });

  it("中を pointerdown しても閉じない（引き金のボタンごと包むのが前提）", () => {
    render(<Sample />);
    open();
    fireEvent.pointerDown(screen.getByText("中身"));
    fireEvent.pointerDown(screen.getByRole("button", { name: "開く" }));
    expect(screen.getByText("中身")).toBeInTheDocument();
  });

  it("Esc で閉じる。他のキーでは閉じない", () => {
    render(<Sample />);
    open();
    fireEvent.keyDown(document, { key: "a" });
    expect(screen.getByText("中身")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByText("中身")).toBeNull();
  });

  it("閉じている間は何も見張らない（外を触っても onClose を呼ばない）", () => {
    const onClose = vi.fn();
    render(<Sample onClose={onClose} />);
    fireEvent.pointerDown(screen.getByRole("button", { name: "外のボタン" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("閉じたあとは見張りを外す（document に聞き手が残らない）", () => {
    const add = vi.spyOn(document, "addEventListener");
    const remove = vi.spyOn(document, "removeEventListener");
    render(<Sample />);
    open();
    const added = add.mock.calls.filter(([type]) => type === "pointerdown" || type === "keydown").length;
    fireEvent.keyDown(document, { key: "Escape" });
    const removed = remove.mock.calls.filter(([type]) => type === "pointerdown" || type === "keydown").length;
    expect(removed).toBe(added);
    add.mockRestore();
    remove.mockRestore();
  });
});
