import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect, useImperativeHandle } from "react";
import type { MapBounds } from "@/lib/map/get-map-pins";
import type { GoogleMapHandle } from "./GoogleMap";
import { resolveMapOpen } from "./map-navigation";
import type { ItineraryApi } from "@/components/itineraries/itinerary-api";
import type { ItineraryDetail, ItinerarySpotItem } from "@/lib/itineraries/get-itinerary";

/**
 * #763（2026-10-06）: 全画面の地図でピンを押したら、下にカードを出す
 * 出典: Issue #763「全画面の地図でピンをタップしたら、下にカードを出す」
 *
 * 【初心者向け】Google マップ本体は描けないので、`GoogleMap` を
 * 「渡されたピンをボタンで並べるだけ」の偽物に差し替える。押すと本物と同じ `onPinClick` が呼ばれる。
 */
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

const panTo = vi.fn();
const BOUNDS: MapBounds = { north: 35.7, south: 35.6, east: 139.8, west: 139.7 };
let latestPins: { id: string; label?: string | number; selected?: boolean }[] = [];

vi.mock("./GoogleMap", () => ({
  GoogleMap: ({
    ref,
    pins,
    onBoundsChange,
    onPinClick,
  }: {
    ref?: React.Ref<GoogleMapHandle>;
    pins: { id: string; label?: string | number; selected?: boolean }[];
    onBoundsChange?: (bounds: MapBounds, center: { lat: number; lng: number }) => void;
    onPinClick?: (id: string) => void;
  }) => {
    latestPins = pins;
    useImperativeHandle(ref, () => ({ panTo, fitBounds: vi.fn(), getCenter: () => ({ lat: 35.65, lng: 139.75 }), getZoom: () => 14 }));
    useEffect(() => {
      onBoundsChange?.(BOUNDS, { lat: 35.65, lng: 139.75 });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
      <div data-testid="map-stub">
        {pins.map((mapPin) => (
          <button key={mapPin.id} type="button" onClick={() => onPinClick?.(mapPin.id)}>
            {`ピン ${mapPin.id}`}
          </button>
        ))}
      </div>
    );
  },
}));

import { MapScreen } from "./MapScreen";

const spot = (spotId: string, overrides: Partial<ItinerarySpotItem> = {}): ItinerarySpotItem => ({
  id: `is-${spotId}`,
  spotId,
  name: `スポット${spotId}`,
  prefecture: "大阪府",
  lat: 34.7,
  lng: 135.5,
  isManualSpot: false,
  dayIndex: 1,
  arrivalTime: null,
  sortOrder: 0,
  memo: null,
  checkedAt: null,
  checkedBy: null,
  hasPosted: false,
  ratingAverage: 4,
  postCount: 3,
  ...overrides,
});

const itinerary: ItineraryDetail = {
  id: "it-1",
  tripId: "trip-1",
  title: "沖縄本島ぐるっと一周 5 泊 6 日",
  startDate: "2026-11-01",
  endDate: "2026-11-02",
  dayCount: 2,
  dayDates: ["2026-11-01", "2026-11-02"],
  role: "owner",
  spots: [
    spot("a", { arrivalTime: "09:30", memo: "朝イチが空いてる" }),
    spot("b", { sortOrder: 1 }),
    spot("c", { dayIndex: 2 }),
  ],
  members: [],
  albumPostCount: 0,
  updatedAt: "2026-11-01T00:00:00Z",
};

const api = { get: vi.fn(async () => ({ itinerary })) } as unknown as ItineraryApi;
const resolveCenter = () => Promise.resolve({ center: { lat: 34.7, lng: 135.5 }, zoom: 13, source: "fallback" as const });
const open = resolveMapOpen({ itinerary: "it-1", day: "1" });

async function settle() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(400);
  });
}

const show = async () => {
  render(<MapScreen open={open} itineraryApi={api} resolveCenter={resolveCenter} />);
  await screen.findByTestId("map-stub");
  await settle();
  await waitFor(() => expect(screen.getByRole("button", { name: "ピン a" })).toBeInTheDocument());
};

const cards = () => Array.from(document.querySelectorAll("[data-map-card]")).map((card) => card.getAttribute("data-map-card"));

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  push.mockClear();
  panTo.mockClear();
  latestPins = [];
});

describe("全画面の地図のカード帯（#763）", () => {
  it("ピンを押す前はカードを出さない（地図が全部見える）", async () => {
    await show();
    expect(document.querySelector("[data-itinerary-cards]")).toBeNull();
  });

  it("ピンを押すと地図から出ずに、その Day のカードが出る", async () => {
    await show();
    fireEvent.click(screen.getByRole("button", { name: "ピン a" }));
    expect(push).not.toHaveBeenCalled(); // しおり詳細へ戻らない
    expect(document.querySelector("[data-itinerary-cards]")).toBeInTheDocument();
    // Day 1 のタブなので Day 2 の c は出ない
    expect(cards()).toEqual(["a", "b"]);
    expect(document.querySelector("[data-map-card='a']")).toHaveAttribute("aria-current", "true");
  });

  it("カードの中身は 番号・スポット名・メモ・時刻・Day。「投稿する」は出さない", async () => {
    await show();
    fireEvent.click(screen.getByRole("button", { name: "ピン a" }));
    const card = document.querySelector("[data-map-card='a']") as HTMLElement;
    expect(card.textContent).toContain("1");
    expect(card.textContent).toContain("スポットa");
    expect(card.textContent).toContain("朝イチが空いてる");
    expect(card.textContent).toContain("09:30");
    expect(card.textContent).toContain("Day 1");
    expect(document.querySelector("[data-itinerary-cards]")?.textContent).not.toContain("投稿");
  });

  it("押したピンは地図の上でも大きくなる（selected）", async () => {
    await show();
    fireEvent.click(screen.getByRole("button", { name: "ピン b" }));
    await waitFor(() => expect(latestPins.find((mapPin) => mapPin.id === "b")?.selected).toBe(true));
    expect(latestPins.find((mapPin) => mapPin.id === "a")?.selected).toBeUndefined();
  });

  it("カードを押すと、しおり詳細のそのスポットの行へ行く（今までと同じ行き先）", async () => {
    await show();
    fireEvent.click(screen.getByRole("button", { name: "ピン a" }));
    fireEvent.click(document.querySelector("[data-map-card='a']") as HTMLElement);
    expect(push).toHaveBeenCalledWith("/itineraries/it-1?day=1&spot=a");
  });

  it("Day を切り替えるとカードが引っ込む（その Day に無いことがあるため）", async () => {
    await show();
    fireEvent.click(screen.getByRole("button", { name: "ピン a" }));
    expect(document.querySelector("[data-itinerary-cards]")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Day 2" }));
    expect(document.querySelector("[data-itinerary-cards]")).toBeNull();
    // Day 2 のピンを押せば、その Day のカードが出る
    await waitFor(() => expect(screen.getByRole("button", { name: "ピン c" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "ピン c" }));
    expect(cards()).toEqual(["c"]);
  });

  it("右上にしおりのタイトルの帯を出さない（どのしおりかは分かっているため）", async () => {
    await show();
    expect(screen.queryByText(itinerary.title)).toBeNull();
  });
});
