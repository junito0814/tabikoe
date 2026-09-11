import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { WishlistButton } from "./WishlistButton";

/**
 * 出典: docs/tasks/records/wishlist/03-wishlist-entry-points-ui.md 単体テスト
 * - 保存済み・未保存それぞれの状態で、ボタンの表示（アイコン・ラベル）が切り替わること
 */
describe("WishlistButton", () => {
  it("未保存の状態では「行きたい」と表示し、押されていない状態になっている", () => {
    render(<WishlistButton spotId="s1" initialSaved={false} submitToggle={vi.fn()} />);
    const button = screen.getByRole("button", { name: "行きたいに保存" });
    expect(button).toHaveTextContent("行きたい");
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button.querySelector("path")).toHaveAttribute("fill", "none");
  });

  it("保存済みの状態では「保存済み」と表示し、アイコンが塗られる", () => {
    render(<WishlistButton spotId="s1" initialSaved submitToggle={vi.fn()} />);
    const button = screen.getByRole("button", { name: "行きたいを解除" });
    expect(button).toHaveTextContent("保存済み");
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button.querySelector("path")).toHaveAttribute("fill", "currentColor");
  });

  it("押すと保存APIを呼び、保存済み表示に切り替わる", async () => {
    const submitToggle = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
    const onChange = vi.fn();
    render(
      <WishlistButton spotId="s1" initialSaved={false} submitToggle={submitToggle} onChange={onChange} />
    );

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(screen.getByRole("button")).toHaveTextContent("保存済み"));
    expect(submitToggle).toHaveBeenCalledWith("s1", true);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("保存済みから押すと取消APIを呼び、未保存表示に戻る", async () => {
    const submitToggle = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    render(<WishlistButton spotId="s1" initialSaved submitToggle={submitToggle} />);

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(screen.getByRole("button")).toHaveTextContent("行きたい"));
    expect(submitToggle).toHaveBeenCalledWith("s1", false);
  });

  it("API失敗時は元の状態に戻す", async () => {
    const submitToggle = vi.fn().mockResolvedValue(new Response(null, { status: 500 }));
    render(<WishlistButton spotId="s1" initialSaved={false} submitToggle={submitToggle} />);

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(screen.getByRole("button")).not.toBeDisabled());
    expect(screen.getByRole("button")).toHaveTextContent("行きたい");
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false");
  });
});
