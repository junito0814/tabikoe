import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SearchMapView } from "./SearchMapView";
import type { SpotCardData } from "@/lib/spots/search-spots";

/**
 * 出典: #681（検索結果に「地図」タブを足す）単体テスト
 * 要件定義書 3.4.2「地図タブ」・ワイヤーフレーム決定事項 71
 *
 * 【初心者向け】本物の Google マップは単体テストでは動かせないので、
 * **地図の部品を差し替えて**「どんなピンを渡したか」「範囲を合わせたか」を見る。
 */
const fitBounds = vi.fn();
const panTo = vi.fn();
let lastPins: { id: string; type: string; category?: string | null }[] = [];

vi.mock("@/components/map/GoogleMap", () => ({
  GoogleMap: ({ pins, ref, onPinClick }: { pins: { id: string; type: string; category?: string | null }[]; ref?: { current: unknown }; onPinClick?: (id: string) => void }) => {
    lastPins = pins;
    if (ref) ref.current = { fitBounds, panTo, getCenter: () => null, getZoom: () => null };
    return (
      <div data-testid="map">
        {pins.map((pin) => (
          <button key={pin.id} type="button" onClick={() => onPinClick?.(pin.id)}>
            ピン:{pin.id}
          </button>
        ))}
      </div>
    );
  },
}));

const spot = (id: string, lat: number, lng: number): SpotCardData => ({
  id,
  name: `スポット${id}`,
  lat,
  lng,
  prefecture: "東京都",
  category: "観光スポット",
  isManualSpot: false,
  postCount: 3,
  averageRating: 4.2,
  coverUrl: null,
  coverMediaType: null,
  latestComment: null,
  latestPostAt: "2026-10-01T00:00:00.000Z",
  latestStatus: null,
  walkMinutes: null,
  viewerHasSaved: false,
});

const spots = [spot("a", 35.0, 139.0), spot("b", 36.0, 140.0)];

describe("SearchMapView（#681）", () => {
  it("結果のスポットをピンにする", () => {
    render(<SearchMapView spots={spots} backHref="/search?pref=東京都" hasMore={false} isLoading={false} onLoadMore={vi.fn()} />);
    expect(lastPins.map((pin) => pin.id)).toEqual(["a", "b"]);
    expect(screen.getByText("スポットa")).toBeInTheDocument();
  });

  it("開いたときに全部入る範囲へ合わせる（追加の通信はしない）", () => {
    fitBounds.mockClear();
    render(<SearchMapView spots={spots} backHref="/search" hasMore={false} isLoading={false} onLoadMore={vi.fn()} />);
    expect(fitBounds).toHaveBeenCalledTimes(1);
    const [southWest, northEast] = fitBounds.mock.calls[0]![0] as { lat: number; lng: number }[];
    expect(southWest!.lat).toBeLessThanOrEqual(35.0);
    expect(northEast!.lat).toBeGreaterThanOrEqual(36.0);
  });

  it("続きを読んでも地図は動かさない（見ている場所が飛ばない）", () => {
    fitBounds.mockClear();
    const { rerender } = render(<SearchMapView spots={spots} backHref="/search" hasMore isLoading={false} onLoadMore={vi.fn()} />);
    expect(fitBounds).toHaveBeenCalledTimes(1);
    rerender(<SearchMapView spots={[...spots, spot("c", 37.0, 141.0)]} backHref="/search" hasMore={false} isLoading={false} onLoadMore={vi.fn()} />);
    expect(fitBounds).toHaveBeenCalledTimes(1);
  });

  it("カードを選ぶとそのピンが強調され、地図が寄る", () => {
    panTo.mockClear();
    render(<SearchMapView spots={spots} backHref="/search" hasMore={false} isLoading={false} onLoadMore={vi.fn()} />);
    fireEvent.click(screen.getByText("スポットb"));
    expect(panTo).toHaveBeenCalledWith({ lat: 36.0, lng: 140.0 }, 15);
    expect(lastPins.find((pin) => pin.id === "b")!.type).toBe("focus");
    expect(lastPins.find((pin) => pin.id === "a")!.type).toBe("post");
  });

  it("ピンを押しても同じように選ばれる", () => {
    render(<SearchMapView spots={spots} backHref="/search" hasMore={false} isLoading={false} onLoadMore={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "ピン:a" }));
    expect(document.querySelector("[data-map-card='a']")).toHaveAttribute("data-selected", "true");
  });

  /*
   * #876（2026-10-07）: ピンを押したら、そのカードまで送る。
   *
   * 【初心者向け】この画面は吹き出しを出さず、下のカードがその代わり（決定事項 71）。
   * ところがカードが画面の外のままだと、押しても何も起きていないように見えていた。
   */
  it("ピンを押すと、そのカードまで送る（#876）", () => {
    render(<SearchMapView spots={spots} backHref="/search" hasMore={false} isLoading={false} onLoadMore={vi.fn()} />);
    // jsdom には scrollIntoView が無いので、呼ばれたことだけ見る
    const card = document.querySelector("[data-map-card='b']") as HTMLElement;
    const scrollIntoView = vi.fn();
    card.scrollIntoView = scrollIntoView;
    fireEvent.click(screen.getByRole("button", { name: "ピン:b" }));
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest", inline: "center" });
  });

  it("選んだカードは枠が太くなる（色だけに頼らない）", () => {
    render(<SearchMapView spots={spots} backHref="/search" hasMore={false} isLoading={false} onLoadMore={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "ピン:b" }));
    const card = document.querySelector("[data-map-card='b']") as HTMLElement;
    expect(card.className).toContain("border-2");
    expect(document.querySelector("[data-map-card='a']")!.className).not.toContain("border-2");
  });

  it("カードから投稿一覧へ行ける（戻り先つき）", () => {
    render(<SearchMapView spots={spots} backHref="/search?pref=東京都" hasMore={false} isLoading={false} onLoadMore={vi.fn()} />);
    expect(screen.getAllByRole("link", { name: "投稿を見る" })[0]).toHaveAttribute(
      "href",
      "/spots/a?back=%2Fsearch%3Fpref%3D%E6%9D%B1%E4%BA%AC%E9%83%BD"
    );
  });

  it("カードを右端まで送ったら次を読む", () => {
    const onLoadMore = vi.fn();
    render(<SearchMapView spots={spots} backHref="/search" hasMore isLoading={false} onLoadMore={onLoadMore} />);
    const strip = document.querySelector("[data-map-card-strip]") as HTMLElement;
    Object.defineProperty(strip, "scrollWidth", { value: 1000, configurable: true });
    Object.defineProperty(strip, "clientWidth", { value: 400, configurable: true });
    Object.defineProperty(strip, "scrollLeft", { value: 560, configurable: true });
    fireEvent.scroll(strip);
    expect(onLoadMore).toHaveBeenCalled();
  });

  it("まだ読むものが無ければ呼ばない", () => {
    const onLoadMore = vi.fn();
    render(<SearchMapView spots={spots} backHref="/search" hasMore={false} isLoading={false} onLoadMore={onLoadMore} />);
    const strip = document.querySelector("[data-map-card-strip]") as HTMLElement;
    Object.defineProperty(strip, "scrollWidth", { value: 1000, configurable: true });
    Object.defineProperty(strip, "clientWidth", { value: 400, configurable: true });
    Object.defineProperty(strip, "scrollLeft", { value: 600, configurable: true });
    fireEvent.scroll(strip);
    expect(onLoadMore).not.toHaveBeenCalled();
  });
});

/**
 * #741（2026-10-06）: ピンがカテゴリごとの色に分かれていなかった。
 * ピンの色と記号は `category` で決まるのに、渡していなかった。
 */
describe("ピンの色（#741）", () => {
  it("カテゴリをピンに渡す", () => {
    render(
      <SearchMapView
        spots={[{ ...spot("a", 35, 139), category: "グルメ" }, { ...spot("b", 36, 140), category: "自然・景勝地" }]}
        backHref="/search"
        hasMore={false}
        isLoading={false}
        onLoadMore={vi.fn()}
      />
    );
    expect(lastPins.map((pin) => pin.category)).toEqual(["グルメ", "自然・景勝地"]);
  });

  it("カテゴリが決まらないスポットでも落ちない", () => {
    render(
      <SearchMapView spots={[{ ...spot("a", 35, 139), category: null }]} backHref="/search" hasMore={false} isLoading={false} onLoadMore={vi.fn()} />
    );
    expect(lastPins[0]!.category).toBeNull();
  });
});
