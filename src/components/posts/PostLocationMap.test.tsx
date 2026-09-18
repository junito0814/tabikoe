/**
 * 出典: docs/tasks/posts/spot-selection-v3/01-fixed-pin-map-component.md（単体テスト）
 * 「地図の中心変更で onCenterChange が呼ばれること」「lockedPosition があるとき中心変更で位置が変わらないこと」
 * 「位置情報拒否時に東京駅周辺と案内文になること」
 */
import { describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";

type BoundsHandler = (bounds: { north: number; south: number; east: number; west: number }, center: { lat: number; lng: number }) => void;
let lastOnBoundsChange: BoundsHandler | undefined;
vi.mock("@/components/map/GoogleMap", () => ({
  GoogleMap: (props: { onBoundsChange?: BoundsHandler; pins: { type: string }[] }) => {
    lastOnBoundsChange = props.onBoundsChange;
    return <div data-testid="google-map" data-pins={props.pins.map((p) => p.type).join(",")} />;
  },
}));

import { PostLocationMap } from "./PostLocationMap";

const TOKYO = { lat: 35.6812, lng: 139.7671 };

describe("PostLocationMap", () => {
  it("地図の中心が変わると onCenterChange が呼ばれ、2 回目以降で moved になる", async () => {
    const onCenterChange = vi.fn();
    const onMovedChange = vi.fn();
    render(<PostLocationMap initialCenter={{ lat: 1, lng: 2 }} lockedPosition={null} onCenterChange={onCenterChange} onMovedChange={onMovedChange} />);
    await screen.findByTestId("google-map");
    act(() => lastOnBoundsChange?.({ north: 0, south: 0, east: 0, west: 0 }, { lat: 1, lng: 2 }));
    expect(onCenterChange).toHaveBeenCalledWith({ lat: 1, lng: 2 });
    expect(onMovedChange).not.toHaveBeenCalled();
    act(() => lastOnBoundsChange?.({ north: 0, south: 0, east: 0, west: 0 }, { lat: 1.1, lng: 2 }));
    expect(onMovedChange).toHaveBeenCalledWith(true);
  });

  it("lockedPosition があれば中央固定ピンを出さず、固定ピン（focus）を地図に描く", async () => {
    const { container } = render(
      <PostLocationMap initialCenter={{ lat: 1, lng: 2 }} lockedPosition={{ lat: 3, lng: 4 }} onCenterChange={() => {}} />
    );
    expect((await screen.findByTestId("google-map")).getAttribute("data-pins")).toBe("focus");
    expect(container.querySelector("[data-center-pin]")).toBeNull();
  });

  it("位置情報が拒否されたら東京駅周辺で開き、案内文を出す", async () => {
    const onResolved = vi.fn();
    render(
      <PostLocationMap
        initialCenter={null}
        lockedPosition={null}
        onCenterChange={() => {}}
        onCurrentLocationResolved={onResolved}
        resolveCenter={async () => ({ center: TOKYO, zoom: 13, source: "fallback" })}
      />
    );
    await waitFor(() => expect(onResolved).toHaveBeenCalledWith({ center: TOKYO, fromCurrentLocation: false }));
    expect(screen.getByText(/東京駅周辺を表示しています/)).toBeInTheDocument();
  });
});
