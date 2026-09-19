/**
 * 出典: docs/tasks/map-search/search-top/02-search-top-screen.md（単体テスト）
 *       docs/tasks/map-search/search-top/03-submit-and-geocode.md / 04-geolocation-hook.md
 * 「3 要素だけが描画され、地図・一覧が無いこと」「入力で候補が表示されラベルが付くこと」
 * 「座標化失敗時にエラーメッセージが出て遷移しないこと」「拒否時にそれぞれの挙動になること」
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock("@/app/fonts", () => ({ outfit: { className: "" }, lora: { className: "" } }));

import { SearchTopScreen, type SearchTopApi } from "./SearchTopScreen";
import type { DestinationSuggestion } from "@/lib/search/suggest-destinations";

const SUGGESTIONS: DestinationSuggestion[] = [
  { kind: "prefecture", name: "大阪府", lat: 34.6, lng: 135.5 },
  { kind: "station", name: "大阪駅", secondaryText: "大阪府大阪市北区", placeId: "p1" },
  { kind: "spot", name: "大阪城", spotId: "s1", prefecture: "大阪府" },
];
const api: SearchTopApi = {
  suggest: vi.fn(async () => ({ suggestions: SUGGESTIONS, placesUnavailable: false })),
  geocode: vi.fn(async () => null),
};
const denied = { getCurrentPosition: (_ok: PositionCallback, err?: PositionErrorCallback) => err?.({ code: 1 } as GeolocationPositionError) };
const granted = { getCurrentPosition: (ok: PositionCallback) => ok({ coords: { latitude: 35.1, longitude: 139.2 } } as GeolocationPosition) };

beforeEach(() => {
  push.mockReset();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

describe("SearchTopScreen", () => {
  it("入力欄と 2 つのボタンだけがあり、地図や一覧は無い", () => {
    const { container } = render(<SearchTopScreen api={api} geolocation={granted} />);
    expect(screen.getByRole("combobox", { name: "行き先" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "近くのスポットを探す" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ここを投稿" })).toBeInTheDocument();
    expect(container.querySelector("[role=region]")).toBeNull();
  });

  it("入力すると候補が種別ラベル付きで出て、選ぶと投稿一覧へ", async () => {
    render(<SearchTopScreen api={api} geolocation={granted} />);
    fireEvent.change(screen.getByRole("combobox", { name: "行き先" }), { target: { value: "おおさ" } });
    await act(async () => {
      vi.advanceTimersByTime(350);
    });
    await screen.findByRole("option", { name: /^大阪府/ });
    expect(screen.getByText("都道府県")).toBeInTheDocument();
    expect(screen.getByText("駅")).toBeInTheDocument();
    expect(screen.getByText("スポット")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: /大阪城/ }).querySelector("button")!);
    expect(push).toHaveBeenCalledWith("/search?spot=s1");
  });

  it("候補に無い文字列で決定して座標化できなければエラーを出し、遷移しない", async () => {
    const failing: SearchTopApi = { suggest: async () => ({ suggestions: [], placesUnavailable: false }), geocode: async () => null };
    render(<SearchTopScreen api={failing} geolocation={granted} />);
    const input = screen.getByRole("combobox", { name: "行き先" });
    fireEvent.change(input, { target: { value: "xxxxx" } });
    fireEvent.submit(input.closest("form")!);
    await waitFor(() => expect(screen.getByText(/見つかりませんでした/)).toBeInTheDocument());
    expect(push).not.toHaveBeenCalled();
  });

  it("「近くのスポットを探す」は許可なら探すモードへ、拒否なら案内を出して入力欄にフォーカス", async () => {
    const { unmount } = render(<SearchTopScreen api={api} geolocation={granted} />);
    fireEvent.click(screen.getByRole("button", { name: "近くのスポットを探す" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/map?mode=explore&lat=35.1&lng=139.2"));
    unmount();
    push.mockReset();
    render(<SearchTopScreen api={api} geolocation={denied} />);
    fireEvent.click(screen.getByRole("button", { name: "近くのスポットを探す" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("行き先を入力してください"));
    expect(push).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole("combobox", { name: "行き先" })).toHaveFocus());
  });

  it("「ここを投稿」は許可なら現在地付き、拒否なら位置なしで投稿画面へ", async () => {
    const { unmount } = render(<SearchTopScreen api={api} geolocation={granted} />);
    fireEvent.click(screen.getByRole("button", { name: "ここを投稿" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/posts/new?lat=35.1&lng=139.2&from=current"));
    unmount();
    push.mockReset();
    render(<SearchTopScreen api={api} geolocation={denied} />);
    fireEvent.click(screen.getByRole("button", { name: "ここを投稿" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/posts/new?from=current"));
  });
});
