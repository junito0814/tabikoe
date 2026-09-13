import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LikeButton } from "./LikeButton";

/**
 * 出典: docs/tasks/browsing/likes/03-like-button-ui.md 単体テスト
 * - いいね済み状態・未いいね状態それぞれで、ボタンの表示が正しく切り替わることを検証する
 */
const ok = (liked: boolean, likeCount: number) => Response.json({ liked, likeCount });

describe("LikeButton", () => {
  it("未いいね状態は aria-pressed=false、いいね済みは true", () => {
    const { unmount } = render(<LikeButton postId="p1" initialLiked={false} initialCount={3} submitToggle={vi.fn()} />);
    expect(screen.getByRole("button", { name: "いいねする" })).toHaveAttribute("aria-pressed", "false");
    unmount();
    render(<LikeButton postId="p1" initialLiked initialCount={3} submitToggle={vi.fn()} />);
    expect(screen.getByRole("button", { name: "いいねを取り消す" })).toHaveAttribute("aria-pressed", "true");
  });

  it("押すと POST 相当で付与し、表示が切り替わる", async () => {
    const submitToggle = vi.fn(async () => ok(true, 4));
    render(<LikeButton postId="p1" initialLiked={false} initialCount={3} submitToggle={submitToggle} />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(submitToggle).toHaveBeenCalledWith("p1", true));
    await waitFor(() => expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true"));
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("いいね済みから押すと取り消し、表示が戻る", async () => {
    const submitToggle = vi.fn(async () => ok(false, 2));
    render(<LikeButton postId="p1" initialLiked initialCount={3} submitToggle={submitToggle} />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(submitToggle).toHaveBeenCalledWith("p1", false));
    await waitFor(() => expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false"));
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("失敗したら元の状態に戻す", async () => {
    const submitToggle = vi.fn(async () => new Response("", { status: 500 }));
    render(<LikeButton postId="p1" initialLiked={false} initialCount={3} submitToggle={submitToggle} />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(submitToggle).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false"));
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});
