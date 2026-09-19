import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect, useImperativeHandle } from "react";
import type { MapBounds, MapPinData } from "@/lib/map/get-map-pins";
import type { GoogleMapHandle } from "./GoogleMap";
import { resolveMapOpen } from "./map-navigation";

/**
 * 出典: docs/tasks/map-search/map-display-v3/02-map-screen-rebuild.md 単体テスト
 * - クエリに応じた戻るボタンの文言と遷移先、タブが描画されないこと
 * 出典: docs/tasks/map-search/pin-interaction-v3/01-pin-callout.md 単体テスト
 * - 吹き出しの 2 リンクの遷移先
 * 出典: docs/tasks/map-search/pin-interaction-v3/03-draft-pin-callout.md 単体テスト
 * - draft の吹き出しに続きを書くリンクがあること
 * 出典: docs/tasks/browsing/explore-mode/02-explore-mode-ui.md 単体テスト
 * - 半径切替で API が再呼び出しされること、カード切替でフォーカスピンが変わること
 *
 * Google Maps 本体は描画できないため、GoogleMap を「マウント時に一度だけ範囲を通知し、
 * panTo を記録するだけの」スタブに差し替える。
 */
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

const panTo = vi.fn();
const fitBounds = vi.fn();
const BOUNDS: MapBounds = { north: 35.7, south: 35.6, east: 139.8, west: 139.7 };
let latestPins: { id: string; type: string }[] = [];
let triggerLongPress: ((position: { lat: number; lng: number }) => void) | undefined;

vi.mock("./GoogleMap", () => ({
  GoogleMap: ({
    ref,
    pins,
    onBoundsChange,
    onPinClick,
    onLongPress,
    onMapClick,
  }: {
    ref?: React.Ref<GoogleMapHandle>;
    pins: { id: string; type: string }[];
    onBoundsChange?: (bounds: MapBounds, center: { lat: number; lng: number }) => void;
    onPinClick?: (id: string) => void;
    onLongPress?: (position: { lat: number; lng: number }) => void;
    onMapClick?: () => void;
  }) => {
    latestPins = pins;
    triggerLongPress = onLongPress;
    useImperativeHandle(ref, () => ({ panTo, fitBounds, getCenter: () => ({ lat: 35.65, lng: 139.75 }) }));
    useEffect(() => {
      onBoundsChange?.(BOUNDS, { lat: 35.65, lng: 139.75 });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
      <div data-testid="map-stub" onClick={onMapClick}>
        {pins.map((pin) => (
          <button
            key={pin.id}
            type="button"
            onClick={(event) => {
              // 本物の Google マップではマーカーのクリックは地図のクリックにならない
              event.stopPropagation();
              onPinClick?.(pin.id);
            }}
          >
            {pin.id}:{pin.type}
          </button>
        ))}
      </div>
    );
  },
}));

import { MapScreen } from "./MapScreen";

const pin = (id: string, extra: Partial<MapPinData> = {}): MapPinData => ({
  id,
  kind: "post",
  spotId: id,
  name: `スポット${id}`,
  lat: 35.65,
  lng: 139.75,
  prefecture: null,
  postCount: 7,
  ratingAverage: 4,
  latestStatus: { status: "still_there", reportedAt: "2026-09-10T00:00:00Z" },
  draftId: null,
  ...extra,
});

const resolveCenter = () => Promise.resolve({ center: { lat: 35.6812, lng: 139.7671 }, zoom: 13, source: "fallback" as const });

async function settle() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(400);
  });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  panTo.mockClear();
  latestPins = [];
});

describe("MapScreen（SC-02 v3.0）", () => {
  it("タブは無く、3 種別のピンを同時に出す。戻るは「ホーム」", async () => {
    const fetchPins = vi.fn(async () => [pin("a"), pin("b", { kind: "saved" }), pin("draft:d1", { kind: "draft", spotId: null, draftId: "d1", name: "名前のない場所" })]);
    render(<MapScreen open={resolveMapOpen({})} fetchPins={fetchPins} resolveCenter={resolveCenter} />);
    await screen.findByTestId("map-stub");
    await settle();
    expect(screen.queryByRole("tab")).toBeNull();
    expect(screen.queryByRole("searchbox")).toBeNull();
    await waitFor(() => expect(fetchPins).toHaveBeenCalledWith(BOUNDS));
    await waitFor(() =>
      expect(latestPins).toEqual([
        expect.objectContaining({ id: "a", type: "post" }),
        expect.objectContaining({ id: "b", type: "saved" }),
        expect.objectContaining({ id: "draft:d1", type: "draft" }),
      ])
    );
    expect(screen.getByRole("link", { name: "ホーム" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("list", { name: "ピンの凡例" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ここに投稿" })).toBeInTheDocument();
  });

  it("ピンをタップすると吹き出しが出て、本体のタップで一覧へ・「投稿する」のリンク先が正しい（「一覧」ボタンは無い。v3.1）", async () => {
    render(<MapScreen open={resolveMapOpen({})} fetchPins={async () => [pin("spot-1")]} resolveCenter={resolveCenter} />);
    await settle();
    fireEvent.click(await screen.findByRole("button", { name: "spot-1:post" }));
    const callout = await screen.findByRole("dialog", { name: "スポットspot-1" });
    expect(callout).toHaveTextContent("7件");
    expect(callout).toHaveTextContent("9月にまだあった");
    expect(screen.queryByRole("link", { name: "一覧" })).toBeNull();
    expect(callout.querySelector("[data-callout-body]")).toHaveAttribute("href", "/spots/spot-1");
    expect(screen.getByRole("link", { name: "投稿する" })).toHaveAttribute("href", "/posts/new?spot=spot-1");
    expect(panTo).toHaveBeenCalledWith({ lat: 35.65, lng: 139.75 });
    // 地図をタップすると閉じる
    fireEvent.click(screen.getByTestId("map-stub"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("下書きピンの吹き出しには「続きを書く」がある", async () => {
    render(
      <MapScreen
        open={resolveMapOpen({})}
        fetchPins={async () => [pin("draft:d1", { kind: "draft", spotId: null, draftId: "d1", name: "名前のない場所" })]}
        resolveCenter={resolveCenter}
      />
    );
    await settle();
    fireEvent.click(await screen.findByRole("button", { name: "draft:d1:draft" }));
    expect(screen.getByRole("link", { name: "続きを書く" })).toHaveAttribute("href", "/posts/new?draft=d1");
  });

  it("長押しで一時ピンと「ここに投稿」の吹き出しが出る", async () => {
    render(<MapScreen open={resolveMapOpen({})} fetchPins={async () => []} resolveCenter={resolveCenter} />);
    await screen.findByTestId("map-stub");
    act(() => triggerLongPress?.({ lat: 35.66, lng: 139.76 }));
    const callout = screen.getByRole("dialog", { name: "この地点" });
    expect(callout.querySelector("a")).toHaveAttribute("href", "/posts/new?lat=35.66&lng=139.76");
    expect(latestPins).toEqual([expect.objectContaining({ id: "temp", type: "focus" })]);
  });

  it("?spot= で開くと戻るに戻り先の画面名（大阪府）が出て、そのスポットがフォーカスピン＋吹き出し", async () => {
    const open = resolveMapOpen({ spot: "spot-1", lat: "35.65", lng: "139.75", back: "/search?pref=大阪府" });
    render(<MapScreen open={open} fetchPins={async () => [pin("spot-1"), pin("spot-2")]} resolveCenter={resolveCenter} />);
    await settle();
    expect(screen.getByRole("link", { name: "大阪府" })).toHaveAttribute("href", "/search?pref=大阪府");
    await waitFor(() => expect(latestPins).toEqual([expect.objectContaining({ id: "spot-1", type: "focus" }), expect.objectContaining({ id: "spot-2", type: "post" })]));
    expect(await screen.findByRole("dialog", { name: "スポットspot-1" })).toBeInTheDocument();
  });

  it("探すモード: 近くのスポットが出て、半径切替で再取得、カード切替でフォーカスピンが変わる", async () => {
    const fetchNearby = vi.fn(async () => [
      { id: "p1", spotId: "s1", spotName: "展望台", commentExcerpt: "夕日", thumbnailUrl: null, lat: 35.66, lng: 139.76, distanceMeters: 480, walkMinutes: 6 },
      { id: "p2", spotId: "s2", spotName: "直売所", commentExcerpt: "トマト", thumbnailUrl: null, lat: 35.67, lng: 139.77, distanceMeters: 900, walkMinutes: 12 },
    ]);
    const open = resolveMapOpen({ mode: "explore", lat: "35.65", lng: "139.75" });
    render(<MapScreen open={open} fetchPins={async () => [pin("s1"), pin("s2")]} fetchNearby={fetchNearby} resolveCenter={resolveCenter} />);
    await settle();
    expect(screen.getByRole("heading", { name: "近くのスポット" })).toBeInTheDocument();
    await waitFor(() => expect(fetchNearby).toHaveBeenCalledWith({ lat: 35.65, lng: 139.75 }, 1000));
    await waitFor(() => expect(latestPins).toEqual([expect.objectContaining({ id: "s1", type: "focus" }), expect.objectContaining({ id: "s2", type: "post" })]));

    fireEvent.change(screen.getByRole("combobox", { name: "徒歩圏" }), { target: { value: "3000" } });
    await waitFor(() => expect(fetchNearby).toHaveBeenLastCalledWith({ lat: 35.65, lng: 139.75 }, 3000));

    // 2 枚目までスクロールしたことにする（カード幅 176 + 間隔 10）
    const scroller = screen.getByRole("link", { name: /展望台/ }).parentElement as HTMLElement;
    Object.defineProperty(scroller, "scrollLeft", { value: 186, configurable: true });
    fireEvent.scroll(scroller);
    await waitFor(() => expect(latestPins).toEqual([expect.objectContaining({ id: "s1", type: "post" }), expect.objectContaining({ id: "s2", type: "focus" })]));
  });
});
