import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AlbumListControls } from "./AlbumListControls";

/**
 * 出典: #715（アルバムをしおり無しで作れるようにする）単体テスト
 * 要件定義書 3.6.2・ワイヤーフレーム決定事項 82
 */
const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace, refresh: vi.fn() }) }));

describe("アルバムを作る（#715）", () => {
  it("名前を入れて作ると、そのアルバムの中へ入る", async () => {
    const createAlbum = vi.fn(async () => "trip-1");
    render(<AlbumListControls sort="newest" createAlbum={createAlbum} />);
    fireEvent.click(screen.getByRole("button", { name: "＋ 新規" }));
    fireEvent.change(screen.getByLabelText("アルバムの名前"), { target: { value: " 沖縄 2026 夏 " } });
    fireEvent.click(screen.getByRole("button", { name: "作る" }));
    await waitFor(() => expect(createAlbum).toHaveBeenCalledWith("沖縄 2026 夏"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/albums/trip-1"));
  });

  it("しおりは作らないと画面に書いてある", () => {
    render(<AlbumListControls sort="newest" createAlbum={async () => "t"} />);
    fireEvent.click(screen.getByRole("button", { name: "＋ 新規" }));
    expect(screen.getByText(/しおり（旅の計画）は作られません/)).toBeInTheDocument();
  });

  it("名前が空のままでは作れない", () => {
    render(<AlbumListControls sort="newest" createAlbum={async () => "t"} />);
    fireEvent.click(screen.getByRole("button", { name: "＋ 新規" }));
    expect(screen.getByRole("button", { name: "作る" })).toBeDisabled();
  });

  it("× は右上にあり、押すと閉じる（要件 4.5.13）", () => {
    render(<AlbumListControls sort="newest" createAlbum={async () => "t"} />);
    fireEvent.click(screen.getByRole("button", { name: "＋ 新規" }));
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("作れなかったら、その場で伝える", async () => {
    const createAlbum = vi.fn(async () => {
      throw new Error("create_failed");
    });
    render(<AlbumListControls sort="newest" createAlbum={createAlbum} />);
    fireEvent.click(screen.getByRole("button", { name: "＋ 新規" }));
    fireEvent.change(screen.getByLabelText("アルバムの名前"), { target: { value: "沖縄" } });
    fireEvent.click(screen.getByRole("button", { name: "作る" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("作れませんでした");
  });

  it("並び順を変えると URL が変わる", () => {
    render(<AlbumListControls sort="newest" createAlbum={async () => "t"} />);
    fireEvent.change(screen.getByLabelText("並び順"), { target: { value: "oldest" } });
    expect(replace).toHaveBeenCalledWith("/albums?sort=oldest");
  });
});
