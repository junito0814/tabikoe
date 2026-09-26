import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useImperativeHandle } from "react";
import type { LatLng } from "./initial-center";

/**
 * 出典: docs/tasks/shared-ui/map-sheet/01-pinch-and-zoom-controls.md 単体テスト
 * - 地図全体のリンクが無く、「地図を全画面に」ボタンが ?back= つきの SC-02 を指すこと
 * - 初期表示では「戻す」が出ず、地図を動かしたあとに出ること。押すと初期の中心・ズームに戻ること
 *
 * 【初心者向け】本物の Google マップはテストでは動かせないので、GoogleMap を偽物に差し替える。
 * 偽物は「地図が落ち着いた（idle）」ことを知らせるボタンを 1 つ持っていて、
 * それを押すと本物が idle のときに呼ぶのと同じ処理（onBoundsChange）が走る。
 */
const fakeMap = {
  center: { lat: 35.68, lng: 139.76 } as LatLng,
  zoom: 15,
  panTo: vi.fn(),
};

vi.mock("./GoogleMap", () => ({
  GoogleMap: ({
    ref,
    gesture,
    onBoundsChange,
  }: {
    ref?: React.Ref<unknown>;
    gesture?: string;
    onBoundsChange?: (bounds: unknown, center: LatLng) => void;
  }) => {
    useImperativeHandle(ref, () => ({
      panTo: (center: LatLng, zoom?: number) => fakeMap.panTo(center, zoom),
      getZoom: () => fakeMap.zoom,
      getCenter: () => fakeMap.center,
      fitBounds: () => {},
    }));
    return (
      <div data-gesture={gesture}>
        <button type="button" onClick={() => onBoundsChange?.({}, fakeMap.center)}>
          地図が落ち着いた
        </button>
      </div>
    );
  },
}));

const { StaticSpotMap } = await import("./StaticSpotMap");

const spot = { id: "spot-1", name: "東京駅", lat: 35.68, lng: 139.76 };
const href = "/map?spot=spot-1&back=%2Fspots%2Fspot-1";
const settle = () => fireEvent.click(screen.getByRole("button", { name: "地図が落ち着いた" }));

beforeEach(() => {
  fakeMap.center = { lat: spot.lat, lng: spot.lng };
  fakeMap.zoom = 15;
  fakeMap.panTo.mockClear();
});

describe("StaticSpotMap（上部の地図。4.5.8）", () => {
  it("2 本指でだけ動く地図で、全画面への入口は右下のボタンだけ", () => {
    const { container } = render(<StaticSpotMap spot={spot} href={href} />);
    expect(container.querySelector('[data-gesture="cooperative"]')).not.toBeNull();
    const link = screen.getByRole("link", { name: "地図を全画面に" });
    expect(link).toHaveAttribute("href", href);
    // 地図全体を覆うリンク（inset-0）は廃止した
    expect(container.querySelector("a.absolute.inset-0")).toBeNull();
  });

  it("初期表示では「戻す」が出ない。動かしていなければ idle でも出ない", () => {
    render(<StaticSpotMap spot={spot} href={href} />);
    expect(screen.queryByRole("button", { name: "戻す" })).toBeNull();
    settle();
    expect(screen.queryByRole("button", { name: "戻す" })).toBeNull();
  });

  it("動かすと「戻す」が出て、押すと初期の中心・ズームに戻る", () => {
    render(<StaticSpotMap spot={spot} href={href} />);
    fakeMap.center = { lat: 35.69, lng: 139.78 };
    fakeMap.zoom = 17;
    settle();
    fireEvent.click(screen.getByRole("button", { name: "戻す" }));
    expect(fakeMap.panTo).toHaveBeenCalledWith({ lat: spot.lat, lng: spot.lng }, 15);
    expect(screen.queryByRole("button", { name: "戻す" })).toBeNull();
  });

  it("ズームだけ変えたときも「戻す」が出る", () => {
    render(<StaticSpotMap spot={spot} href={href} />);
    fakeMap.zoom = 18;
    settle();
    expect(screen.getByRole("button", { name: "戻す" })).toBeInTheDocument();
  });
});
