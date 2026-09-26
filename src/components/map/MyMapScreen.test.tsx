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
// map-current-location Task1: あしあとには現在地を出さない（要件定義書 4.5.10）
let latestCurrentLocation: { lat: number; lng: number } | null | undefined;

vi.mock("./GoogleMap", () => ({
  GoogleMap: ({
    pins,
    onBoundsChange,
    onPinClick,
    currentLocation,
  }: {
    pins: { id: string; type: string }[];
    onBoundsChange?: (bounds: MapBounds, center: { lat: number; lng: number }) => void;
    onPinClick?: (id: string) => void;
    currentLocation?: { lat: number; lng: number } | null;
  }) => {
    latestCurrentLocation = currentLocation;
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

const pin = (spotId: string, kind: "posted" | "saved" | "draft", latestPostId: string | null) => ({
  id: kind === "draft" ? `draft:${latestPostId}` : spotId,
  spotId,
  name: spotId,
  lat: 35.65,
  lng: 139.75,
  kind,
  latestPostId,
  isWishlisted: kind === "saved",
});

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  push.mockClear();
});

describe("MyMapScreen（SC-12）", () => {
  it("表示切り替えに応じて mode が both → posted → saved と切り替わる", async () => {
    const fetchPins = vi.fn(async () => []);
    render(<MyMapScreen fetchPins={fetchPins} resolveCenter={resolveCenter} />);
    await screen.findByTestId("map-stub");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    await waitFor(() => expect(fetchPins).toHaveBeenLastCalledWith("both", BOUNDS));

    fireEvent.click(screen.getByRole("radio", { name: "投稿のみ" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    await waitFor(() => expect(fetchPins).toHaveBeenLastCalledWith("posted", BOUNDS));

    fireEvent.click(screen.getByRole("radio", { name: "保存済みのみ" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    await waitFor(() => expect(fetchPins).toHaveBeenLastCalledWith("saved", BOUNDS));
    expect(screen.getByRole("radio", { name: "保存済みのみ" })).toHaveAttribute("aria-checked", "true");
  });

  it("投稿済みは posted で投稿詳細へ、保存済みは saved で一覧へ、下書きは draft で続きを書くへ", async () => {
    render(
      <MyMapScreen
        fetchPins={async () => [pin("s-posted", "posted", "post-1"), pin("s-saved", "saved", null), pin("s-draft", "draft", "d1")]}
        resolveCenter={resolveCenter}
      />
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    fireEvent.click(await screen.findByRole("button", { name: "s-posted:posted" }));
    // Bug #471: 「← あしあと」で戻れるよう back を付ける
    expect(push).toHaveBeenCalledWith("/posts/post-1?back=%2Fmymap");
    fireEvent.click(screen.getByRole("button", { name: "s-saved:saved" }));
    expect(push).toHaveBeenCalledWith("/spots/s-saved?back=%2Fmymap");
    fireEvent.click(screen.getByRole("button", { name: "draft:d1:draft" }));
    expect(push).toHaveBeenCalledWith("/posts/new?draft=d1");
  });

  it("あしあとには現在地の点を出さない（4.5.10。自分の記録を見る画面なので）", async () => {
    render(<MyMapScreen fetchPins={async () => []} resolveCenter={resolveCenter} />);
    await screen.findByTestId("map-stub");
    expect(latestCurrentLocation ?? null).toBeNull();
  });
});
