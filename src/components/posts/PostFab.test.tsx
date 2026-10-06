import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }) }));

import { PostFab } from "./PostFab";
import { PostHereButton } from "./PostHereButton";

/**
 * #807: 右下の「＋ ここに投稿」
 * 出典: 要件定義書 3.3.8・3.4.1、ワイヤーフレーム決定事項 83
 * - 位置情報を許可していれば現在地付き、拒否なら位置なしで投稿画面へ（以前のホームの「ここを投稿」と同じ）
 * - 地図画面と同じ部品（PostHereButton）を使っている
 */
const granted = { getCurrentPosition: (ok: PositionCallback) => ok({ coords: { latitude: 35.1, longitude: 139.2 } } as GeolocationPosition) };
const denied = { getCurrentPosition: (_ok: PositionCallback, fail?: PositionErrorCallback) => fail?.({ code: 1 } as GeolocationPositionError) };

describe("PostFab（#807）", () => {
  it("許可なら現在地付きで投稿画面へ", async () => {
    render(<PostFab geolocation={granted} />);
    fireEvent.click(screen.getByRole("button", { name: "ここに投稿" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/posts/new?lat=35.1&lng=139.2&from=current"));
  });

  it("拒否なら位置なしで投稿画面へ（投稿画面が東京駅周辺を出す）", async () => {
    push.mockClear();
    render(<PostFab geolocation={denied} />);
    fireEvent.click(screen.getByRole("button", { name: "ここに投稿" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/posts/new?from=current"));
  });

  it("右下に浮く入れ物（data-post-fab）に、地図と同じ部品（data-post-here）が入っている", () => {
    render(<PostFab geolocation={granted} />);
    expect(document.querySelector("[data-post-fab] [data-post-here]")).not.toBeNull();
  });

  it("PostHereButton は href ならリンク、無ければボタン", () => {
    const { unmount } = render(<PostHereButton href="/posts/new?lat=1&lng=2" />);
    expect(screen.getByRole("link", { name: "ここに投稿" })).toHaveAttribute("href", "/posts/new?lat=1&lng=2");
    unmount();
    render(<PostHereButton onClick={() => {}} />);
    expect(screen.getByRole("button", { name: "ここに投稿" })).toBeInTheDocument();
  });
});
