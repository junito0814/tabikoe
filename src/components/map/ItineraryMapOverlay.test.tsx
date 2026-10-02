import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ALL_DAYS, buildItineraryPins, ItineraryMapOverlay, useItineraryForMap } from "./ItineraryMapOverlay";
import type { ItineraryDetail, ItinerarySpotItem } from "@/lib/itineraries/get-itinerary";

/**
 * 出典: docs/tasks/itinerary/itinerary-map-and-post/01-itinerary-map.md 単体テスト
 * - Day 切替でピンが入れ替わること
 * - 済みが灰色（done）になること
 * - 「すべて」で色分け（dayIndex）になること
 */
const spot = (spotId: string, overrides: Partial<ItinerarySpotItem> = {}): ItinerarySpotItem => ({
  id: `is-${spotId}`,
  spotId,
  name: spotId,
  prefecture: null,
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
  ratingAverage: null,
  postCount: 0,
  ...overrides,
});

const itinerary: ItineraryDetail = {
  id: "it-1",
  tripId: "trip-1",
  title: "大阪旅行",
  startDate: "2026-09-20",
  endDate: "2026-09-21",
  dayCount: 2,
  dayDates: ["2026-09-20", "2026-09-21"],
  role: "owner",
  spots: [
    spot("a", { arrivalTime: "12:00", checkedAt: "2026-09-20T03:00:00Z" }),
    spot("b", { arrivalTime: "10:00" }),
    spot("c", { dayIndex: 2 }),
    spot("d", { dayIndex: null }),
  ],
  members: [],
  albumPostCount: 0,
  updatedAt: "2026-09-01T00:00:00Z",
};

describe("buildItineraryPins", () => {
  it("開いている Day のスポットだけに訪問順の番号ピン。済みは done", () => {
    const pins = buildItineraryPins(itinerary, 1);
    expect(pins.map((pin) => [pin.id, pin.label, pin.done])).toEqual([
      ["b", 1, false],
      ["a", 2, true],
    ]);
    expect(pins[0]).toMatchObject({ type: "numbered", dayIndex: 1 });
    expect(buildItineraryPins(itinerary, 2).map((pin) => pin.id)).toEqual(["c"]);
  });

  it("ALL では全日を Day ごとの色（dayIndex）で。日付なしは ALL にだけ出る（v3.1）", () => {
    const pins = buildItineraryPins(itinerary, ALL_DAYS);
    expect(pins.map((pin) => [pin.id, pin.dayIndex])).toEqual([
      ["b", 1],
      ["a", 1],
      ["c", 2],
      ["d", 0],
    ]);
  });
});

describe("ItineraryMapOverlay", () => {
  it("v3.1: 左端が ALL、続いて Day タブ。「日付なし」タブは無い。押すと onChange", () => {
    const onChange = vi.fn();
    render(<ItineraryMapOverlay itinerary={itinerary} day={1} onChange={onChange} />);
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["ALL", "Day 1", "Day 2"]);
    fireEvent.click(screen.getByRole("tab", { name: "ALL" }));
    expect(onChange).toHaveBeenCalledWith(ALL_DAYS);
    expect(screen.queryByRole("tab", { name: "日付なし" })).toBeNull();
  });
});

/**
 * 出典: docs/tasks/shared-ui/loading-feedback/04-remaining-pending.md 単体テスト（4-4）
 * 要件定義書 4.5.11 の場面 4・8 章 90
 *
 * 【初心者向け】しおりの地図は取得が終わるまでピンも Day タブも出ないので、無言のまま
 * 空の地図が出ていた。「しおりのスポットが消えた」と読めてしまう。
 * `isLoading` は新しい state を足さずに、持っている値から導いている（そこを確かめる）。
 */
describe("useItineraryForMap の isLoading（4-4）", () => {
  /** フックの戻り値をそのまま文字として出すだけの入れ物 */
  function Probe({ itineraryId, api }: { itineraryId: string | null; api: Parameters<typeof useItineraryForMap>[1] }) {
    const { isLoading, failed, itinerary } = useItineraryForMap(itineraryId, api);
    return <span data-testid="state">{`${isLoading ? "loading" : "idle"}/${failed ? "failed" : "ok"}/${itinerary ? "has" : "none"}`}</span>;
  }

  const apiWith = (get: () => Promise<{ itinerary: ItineraryDetail }>) => ({ get } as unknown as Parameters<typeof useItineraryForMap>[1]);

  it("id が無いときは取得中にしない（しおり表示でないとき）", () => {
    render(<Probe itineraryId={null} api={apiWith(() => new Promise(() => {}))} />);
    expect(screen.getByTestId("state")).toHaveTextContent("idle/ok/none");
  });

  it("取得が終わるまでは取得中", () => {
    render(<Probe itineraryId="it-1" api={apiWith(() => new Promise(() => {}))} />);
    expect(screen.getByTestId("state")).toHaveTextContent("loading/ok/none");
  });

  it("取り終えたら取得中をやめる", async () => {
    render(<Probe itineraryId="it-1" api={apiWith(async () => ({ itinerary }))} />);
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("idle/ok/has"));
  });

  it("失敗したときも取得中をやめる（読み込み表示が残らない）", async () => {
    render(
      <Probe
        itineraryId="it-1"
        api={apiWith(async () => {
          throw new Error("boom");
        })}
      />
    );
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("idle/failed/none"));
  });
});
