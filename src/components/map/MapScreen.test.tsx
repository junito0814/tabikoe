import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect, useImperativeHandle } from "react";
import type { MapBounds } from "@/lib/map/get-map-pins";
import type { GoogleMapHandle } from "./GoogleMap";

/**
 * 出典: docs/tasks/map-search/map-display/03-map-screen-ui.md 単体テスト
 * - タブ切り替え時、表示対象（全体／行きたい）が排他的に切り替わることを検証する
 * 出典: docs/tasks/map-search/place-search/02-search-bar-ui.md 単体テスト
 * - 検索結果の緯度経度を地図コンポーネントへ正しく渡すロジックを検証する
 *
 * Google Maps 本体は描画できないため、GoogleMap を「マウント時に一度だけ範囲を通知し、
 * panTo を記録するだけの」スタブに差し替える。
 */
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const panTo = vi.fn();
const BOUNDS: MapBounds = { north: 35.7, south: 35.6, east: 139.8, west: 139.7 };
let latestPins: { id: string; type: string }[] = [];

vi.mock("./GoogleMap", () => ({
  GoogleMap: ({
    ref,
    pins,
    onBoundsChange,
    onPinClick,
  }: {
    ref?: React.Ref<GoogleMapHandle>;
    pins: { id: string; type: string }[];
    onBoundsChange?: (bounds: MapBounds, center: { lat: number; lng: number }) => void;
    onPinClick?: (id: string) => void;
  }) => {
    latestPins = pins;
    useImperativeHandle(ref, () => ({ panTo, getCenter: () => ({ lat: 35.65, lng: 139.75 }) }));
    useEffect(() => {
      onBoundsChange?.(BOUNDS, { lat: 35.65, lng: 139.75 });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
      <div data-testid="map-stub">
        {pins.map((pin) => (
          <button key={pin.id} type="button" onClick={() => onPinClick?.(pin.id)}>
            {pin.id}:{pin.type}
          </button>
        ))}
      </div>
    );
  },
}));

import { MapScreen } from "./MapScreen";

const pin = (spotId: string, extra: Partial<{ hasOwnPost: boolean; isWishlisted: boolean }> = {}) => ({
  spotId,
  name: spotId,
  lat: 35.65,
  lng: 139.75,
  prefecture: null,
  postCount: 1,
  hasOwnPost: false,
  isWishlisted: false,
  ...extra,
});

const resolveCenter = () =>
  Promise.resolve({ center: { lat: 35.6812, lng: 139.7671 }, zoom: 13, source: "fallback" as const });

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  push.mockClear();
  panTo.mockClear();
  latestPins = [];
});

describe("MapScreen（SC-02）", () => {
  it("「全体」「行きたい」タブは排他的に切り替わり、選択中のタブでピンを取り直す", async () => {
    const fetchPins = vi.fn(async (view: string) =>
      view === "all" ? [pin("public-spot"), pin("both", { hasOwnPost: true, isWishlisted: true })] : [pin("saved")]
    );
    render(<MapScreen fetchPins={fetchPins} resolveCenter={resolveCenter} />);

    await screen.findByTestId("map-stub");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    const allTab = screen.getByRole("tab", { name: "全体" });
    const wishlistTab = screen.getByRole("tab", { name: "行きたい" });
    expect(allTab).toHaveAttribute("aria-selected", "true");
    expect(wishlistTab).toHaveAttribute("aria-selected", "false");
    await waitFor(() => expect(fetchPins).toHaveBeenLastCalledWith("all", BOUNDS));
    // Task4: 投稿済み＋行きたい保存済みでも「全体」では normal
    await waitFor(() => expect(latestPins).toEqual([
      { id: "public-spot", type: "normal" },
      { id: "both", type: "normal" },
    ].map((expected) => expect.objectContaining(expected))));

    fireEvent.click(wishlistTab);
    expect(wishlistTab).toHaveAttribute("aria-selected", "true");
    expect(allTab).toHaveAttribute("aria-selected", "false");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    await waitFor(() => expect(fetchPins).toHaveBeenLastCalledWith("wishlist", BOUNDS));
    await waitFor(() => expect(latestPins).toEqual([expect.objectContaining({ id: "saved", type: "wishlist" })]));
  });

  it("ピンをタップすると、そのスポットの投稿一覧（SC-04）へ遷移する", async () => {
    render(<MapScreen fetchPins={async () => [pin("spot-1")]} resolveCenter={resolveCenter} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    fireEvent.click(await screen.findByRole("button", { name: "spot-1:normal" }));
    expect(push).toHaveBeenCalledWith("/spots/spot-1");
  });

  it("地名検索の結果の緯度経度を地図へ渡して移動する", async () => {
    const searchPlace = vi.fn(async () => ({
      status: "found" as const,
      place: { lat: 34.7024, lng: 135.4959, formattedAddress: "大阪駅" },
    }));
    render(<MapScreen fetchPins={async () => []} resolveCenter={resolveCenter} searchPlace={searchPlace} />);
    await screen.findByTestId("map-stub");

    fireEvent.change(screen.getByRole("searchbox", { name: "地名検索" }), { target: { value: "大阪駅" } });
    fireEvent.submit(screen.getByRole("search"));

    await waitFor(() => expect(searchPlace).toHaveBeenCalledWith("大阪駅"));
    await waitFor(() => expect(panTo).toHaveBeenCalledWith({ lat: 34.7024, lng: 135.4959 }, expect.any(Number)));
  });

  it("地名が見つからなければメッセージを出し、地図は動かさない", async () => {
    render(
      <MapScreen
        fetchPins={async () => []}
        resolveCenter={resolveCenter}
        searchPlace={async () => ({ status: "not_found" as const })}
      />
    );
    await screen.findByTestId("map-stub");
    fireEvent.change(screen.getByRole("searchbox", { name: "地名検索" }), { target: { value: "xxxx" } });
    fireEvent.submit(screen.getByRole("search"));
    expect(await screen.findByText("該当する地名が見つかりませんでした")).toBeInTheDocument();
    expect(panTo).not.toHaveBeenCalled();
  });
});
