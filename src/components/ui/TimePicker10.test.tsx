import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MINUTES, splitTime, TimePicker10 } from "./TimePicker10";

/**
 * 出典: docs/tasks/itinerary/arrival-time/02-time-picker-10min.md 単体テスト
 * - 分の選択肢が 6 個であること
 * - クリアで null になること
 * - キーボードで選べること
 */
describe("TimePicker10", () => {
  it("分の選択肢は 00〜50 の 6 個", () => {
    render(<TimePicker10 value="10:00" onChange={vi.fn()} />);
    const minutes = screen.getByRole("listbox", { name: "分" });
    expect(minutes.querySelectorAll("[role=option]")).toHaveLength(6);
    expect(MINUTES).toEqual([0, 10, 20, 30, 40, 50]);
  });

  it("クリアで null、決定で HH:MM", () => {
    const onChange = vi.fn();
    render(<TimePicker10 value="12:30" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "クリア" }));
    expect(onChange).toHaveBeenLastCalledWith(null);
    fireEvent.click(screen.getByRole("option", { name: "40" }));
    fireEvent.click(screen.getByRole("button", { name: "12:40 にする" }));
    expect(onChange).toHaveBeenLastCalledWith("12:40");
  });

  it("キーボード（↑↓）で選べる", () => {
    const onChange = vi.fn();
    render(<TimePicker10 value="10:00" onChange={onChange} />);
    const hours = screen.getByRole("listbox", { name: "時" });
    fireEvent.keyDown(hours, { key: "ArrowDown" });
    fireEvent.keyDown(hours, { key: "ArrowDown" });
    fireEvent.keyDown(hours, { key: "ArrowUp" });
    expect(screen.getByRole("button", { name: "11:00 にする" })).toBeInTheDocument();
    expect(splitTime("09:50")).toEqual({ hour: 9, minute: 50 });
  });
});
