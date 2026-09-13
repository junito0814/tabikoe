import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import type { MapBounds } from "@/lib/map/get-map-pins";

/**
 * 出典: docs/tasks/records/my-map/02-map-component-reuse-integration.md 単体テスト
 * - 表示切り替えUIの選択に応じて、Task1への問い合わせパラメータ（mode）が正しく切り替わることを検証する
 * 出典: docs/tasks/records/my-map/03-pin-tap-navigation.md
 * - 投稿済みピン → /posts/[id]、「行きたい」ピン → /spots/[id]
 */
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const BOUNDS: MapBounds = { north: 35.7, south: 35.6, east: 139.8, west: 139.7 };

vi.mock("./GoogleMap", () => ({
  GoogleMap: ({
    pins,
    onBoundsChange,
    onPinClick,
  }: {
    pins: { id: string; type: string }[];
    onBoundsChange?: (bounds: MapBounds, center: { lat: number; lng: number }) => void;
    onPinClick?: (id: string) => void;
  }) => {
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

import { MyMapScreen } from "./MyMapScreen";

const resolveCenter = () =>
  Promise.resolve({ center: { lat: 35.6812, lng: 139.7671 }, zoom: 13, source: "fallback" as const });

const pin = (spotId: string, kind: "posted" | "wishlist", latestPostId: string | null) => ({
  spotId,
  name: spotId,
  lat: 35.65,
  lng: 139.75,
  kind,
  latestPostId,
  isWishlisted: kind === "wishlist",
});

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  push.mockClear();
});

describe("MyMapScreen（SC-12）", () => {
  it("表示切り替えに応じて mode が both → posted → wishlist と切り替わる", async () => {
    const fetchPins = vi.fn(async () => []);
    render(<MyMapScreen fetchPins={fetchPins} resolveCenter={resolveCenter} />);
    await screen.findByTestId("map-stub");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    await waitFor(() => expect(fetchPins).toHaveBeenLastCalledWith("both", BOUNDS));

    fireEvent.click(screen.getByRole("radio", { name: "自分の投稿" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    await waitFor(() => expect(fetchPins).toHaveBeenLastCalledWith("posted", BOUNDS));

    fireEvent.click(screen.getByRole("radio", { name: "行きたい" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    await waitFor(() => expect(fetchPins).toHaveBeenLastCalledWith("wishlist", BOUNDS));
    expect(screen.getByRole("radio", { name: "行きたい" })).toHaveAttribute("aria-checked", "true");
  });

  it("投稿済みピンは posted 種別で描かれ、タップで投稿詳細へ。行きたいピンは wishlist 種別で一覧へ", async () => {
    render(
      <MyMapScreen
        fetchPins={async () => [pin("s-posted", "posted", "post-1"), pin("s-wish", "wishlist", null)]}
        resolveCenter={resolveCenter}
      />
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    fireEvent.click(await screen.findByRole("button", { name: "s-posted:posted" }));
    expect(push).toHaveBeenCalledWith("/posts/post-1");
    fireEvent.click(screen.getByRole("button", { name: "s-wish:wishlist" }));
    expect(push).toHaveBeenCalledWith("/spots/s-wish");
  });
});
