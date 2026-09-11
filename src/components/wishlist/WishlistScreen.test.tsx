import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { WishlistScreen } from "./WishlistScreen";
import { SPOT_PLACEHOLDER_IMAGE_URL, type WishlistItem } from "@/lib/wishlist/constants";

/**
 * 出典: docs/tasks/records/wishlist/02-wishlist-list-screen.md（SC-08）
 * - 投稿がないスポットにはプレースホルダ画像が表示されること
 * - 一覧から保存を取り消すと一覧から消えること（Task4 シナリオ3 の単体相当）
 */
const items: WishlistItem[] = [
  {
    spotId: "a",
    name: "浅草寺",
    prefecture: "東京都",
    lat: 35,
    lng: 139,
    savedAt: "2026-09-12T00:00:00Z",
    thumbnailUrl: "https://example.com/a.jpg",
    hasPost: true,
  },
  {
    spotId: "b",
    name: "投稿のない場所",
    prefecture: null,
    lat: 34,
    lng: 135,
    savedAt: "2026-09-11T00:00:00Z",
    thumbnailUrl: SPOT_PLACEHOLDER_IMAGE_URL,
    hasPost: false,
  },
];

describe("WishlistScreen", () => {
  it("保存が無ければ空メッセージ", () => {
    render(<WishlistScreen initialItems={[]} submitRemove={vi.fn()} />);
    expect(screen.getByText("まだ「行きたい」スポットはありません")).toBeInTheDocument();
  });

  it("投稿があるスポットは写真、投稿がないスポットはプレースホルダを表示する", () => {
    render(<WishlistScreen initialItems={items} submitRemove={vi.fn()} />);

    expect(screen.getByAltText("浅草寺の写真")).toHaveAttribute("src", "https://example.com/a.jpg");
    const placeholder = screen.getByAltText("投稿がないスポット");
    expect(placeholder).toHaveAttribute("src", SPOT_PLACEHOLDER_IMAGE_URL);
    expect(placeholder).toHaveAttribute("data-placeholder", "true");
  });

  it("解除すると取消APIを呼び、その行だけ消える", async () => {
    const submitRemove = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    render(<WishlistScreen initialItems={items} submitRemove={submitRemove} />);

    fireEvent.click(screen.getByRole("button", { name: "浅草寺の保存を解除" }));

    await waitFor(() => expect(screen.queryByText("浅草寺")).not.toBeInTheDocument());
    expect(submitRemove).toHaveBeenCalledWith("a");
    expect(screen.getByText("投稿のない場所")).toBeInTheDocument();
  });

  it("解除に失敗したらエラーを表示し、行は残る", async () => {
    const submitRemove = vi.fn().mockResolvedValue(new Response(null, { status: 500 }));
    render(<WishlistScreen initialItems={items} submitRemove={submitRemove} />);

    fireEvent.click(screen.getByRole("button", { name: "浅草寺の保存を解除" }));

    await waitFor(() => expect(screen.getByText("保存を解除できませんでした")).toBeInTheDocument());
    expect(screen.getByText("浅草寺")).toBeInTheDocument();
  });
});
