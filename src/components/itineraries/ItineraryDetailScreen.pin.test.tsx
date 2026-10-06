import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

/**
 * #761（2026-10-06）: 上 1/3 の地図のピンを押したら、一覧のその行へ飛んで一瞬光らせる
 * 出典: Issue #761「しおりの地図のピンをタップしたら、一覧のその行へ飛んで光らせる」
 *
 * 【初心者向け】Google マップそのものはテストでは動かせないので、
 * `ItineraryStaticMap` を**ピンの数だけボタンを出すだけの偽物**に差し替える。
 * 押すと本物と同じ `onPinClick(スポットの id)` が呼ばれるので、
 * 「押したあと一覧がどうなるか」だけを確かめられる。
 */
vi.mock("@/components/map/ItineraryStaticMap", () => ({
  ItineraryStaticMap: ({ onPinClick, selectedSpotId }: { onPinClick?: (spotId: string) => void; selectedSpotId?: string | null }) => (
    <div data-fake-map data-selected={selectedSpotId ?? ""}>
      {["a", "b", "c"].map((spotId) => (
        <button key={spotId} type="button" onClick={() => onPinClick?.(spotId)}>
          {`ピン ${spotId}`}
        </button>
      ))}
    </div>
  ),
}));

import { ItineraryDetailScreen } from "./ItineraryDetailScreen";
import type { ItineraryApi } from "./itinerary-api";
import type { ItineraryDetail, ItinerarySpotItem } from "@/lib/itineraries/get-itinerary";

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

const detail = (): ItineraryDetail => ({
  id: "it-1",
  tripId: "trip-1",
  title: "大阪旅行",
  startDate: "2026-09-20",
  endDate: "2026-09-22",
  dayCount: 3,
  dayDates: ["2026-09-20", "2026-09-21", "2026-09-22"],
  role: "owner",
  spots: [spot("a"), spot("b", { sortOrder: 1 }), spot("c", { sortOrder: 2 })],
  members: [{ userId: "me", displayName: "たろう", avatarUrl: "/a.png", role: "owner", joinedAt: "2026-09-01T00:00:00Z" }],
  albumPostCount: 0,
  updatedAt: "2026-09-01T00:00:00Z",
});

const api = (current: ItineraryDetail): ItineraryApi =>
  ({
    list: vi.fn(),
    create: vi.fn(),
    get: vi.fn(async () => ({ itinerary: current })),
    updatePeriod: vi.fn(),
    rename: vi.fn(),
    remove: vi.fn(),
    addSpot: vi.fn(),
    updateSpot: vi.fn(async () => Response.json({ ok: true })),
    removeSpot: vi.fn(),
    reorder: vi.fn(),
    issueInvitation: vi.fn(),
    listMembers: vi.fn(),
    removeMember: vi.fn(),
  }) as unknown as ItineraryApi;

const row = (spotId: string) => document.querySelector(`[data-itinerary-spot="${spotId}"]`) as HTMLElement;
const isLit = (spotId: string) => row(spotId).className.includes("ring-accent");

const openMap = () => fireEvent.click(screen.getByRole("button", { name: "地図で見る" }));

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  // jsdom には無いので足す（光らせたあとに行を寄せる処理が使う）
  window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    callback(0);
    return 0;
  }) as typeof window.requestAnimationFrame;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("地図のピンから一覧の行へ（#761）", () => {
  it("ピンを押すとその行が光り、地図側もそのピンを選んだことになる", () => {
    const data = detail();
    render(<ItineraryDetailScreen initial={data} viewerId="me" api={api(data)} />);
    openMap();
    expect(isLit("b")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "ピン b" }));
    expect(isLit("b")).toBe(true);
    expect(document.querySelector("[data-fake-map]")).toHaveAttribute("data-selected", "b");
  });

  it("光るのは一時的（1.5 秒で元に戻る）", () => {
    const data = detail();
    render(<ItineraryDetailScreen initial={data} viewerId="me" api={api(data)} />);
    openMap();
    fireEvent.click(screen.getByRole("button", { name: "ピン b" }));
    act(() => {
      vi.advanceTimersByTime(1400);
    });
    expect(isLit("b")).toBe(true);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(isLit("b")).toBe(false);
  });

  it("別のピンを押すと、光る行がそちらへ移る（前の行は消える）", () => {
    const data = detail();
    render(<ItineraryDetailScreen initial={data} viewerId="me" api={api(data)} />);
    openMap();
    fireEvent.click(screen.getByRole("button", { name: "ピン b" }));
    fireEvent.click(screen.getByRole("button", { name: "ピン c" }));
    expect(isLit("b")).toBe(false);
    expect(isLit("c")).toBe(true);
  });

  it("見えていなければ寄せる（nearest）。「視差効果を減らす」なら滑らかに動かさない", () => {
    const data = detail();
    const scrollIntoView = vi.fn();
    Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", { value: scrollIntoView, configurable: true });
    window.matchMedia = ((query: string) => ({ matches: query.includes("reduce") })) as typeof window.matchMedia;
    render(<ItineraryDetailScreen initial={data} viewerId="me" api={api(data)} />);
    openMap();
    fireEvent.click(screen.getByRole("button", { name: "ピン b" }));
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest", behavior: "auto" });
  });

  it("全画面の地図から ?spot= で戻ってきたときの強調は今までどおり（最初から光っている）", () => {
    const data = detail();
    render(<ItineraryDetailScreen initial={data} viewerId="me" api={api(data)} highlightSpotId="c" />);
    expect(isLit("c")).toBe(true);
  });
});
