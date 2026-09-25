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
    useImperativeHandle(ref, () => ({ panTo, fitBounds, getCenter: () => ({ lat: 35.65, lng: 139.75 }), getZoom: () => 14 }));
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

  it("ピンをタップすると吹き出しが出て、本体・「投稿を見る」のどちらでも投稿一覧へ（「一覧」「投稿する」は無い。v3.1／2026-09-25）", async () => {
    render(<MapScreen open={resolveMapOpen({})} fetchPins={async () => [pin("spot-1")]} resolveCenter={resolveCenter} />);
    await settle();
    fireEvent.click(await screen.findByRole("button", { name: "spot-1:post" }));
    const callout = await screen.findByRole("dialog", { name: "スポットspot-1" });
    expect(callout).toHaveTextContent("7件");
    expect(callout).toHaveTextContent("9月にまだあった");
    expect(screen.queryByRole("link", { name: "一覧" })).toBeNull();
    // Bug #471: 一覧から「← 地図」でこの地図（URL ごと）に戻れるよう back を付ける（テストでは jsdom の URL "/"）
    expect(callout.querySelector("[data-callout-body]")).toHaveAttribute("href", "/spots/spot-1?back=%2F");
    // map-restore Task2（2026-09-25）: 「投稿する」を「投稿を見る」に変更（行き先は本体タップと同じ投稿一覧）
    expect(screen.getByRole("link", { name: "投稿を見る" })).toHaveAttribute("href", "/spots/spot-1?back=%2F");
    expect(screen.queryByRole("link", { name: "投稿する" })).toBeNull();
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
      { id: "p1", spotId: "s1", spotName: "展望台", commentExcerpt: "夕日", thumbnailUrl: null, lat: 35.66, lng: 139.76, distanceMeters: 480, walkMinutes: 6, minutes: 6, mode: "walk" as const },
      { id: "p2", spotId: "s2", spotName: "直売所", commentExcerpt: "トマト", thumbnailUrl: null, lat: 35.67, lng: 139.77, distanceMeters: 900, walkMinutes: 12, minutes: 12, mode: "walk" as const },
    ]);
    const open = resolveMapOpen({ mode: "explore", lat: "35.65", lng: "139.75" });
    render(<MapScreen open={open} fetchPins={async () => [pin("s1"), pin("s2")]} fetchNearby={fetchNearby} resolveCenter={resolveCenter} />);
    await settle();
    expect(screen.getByRole("heading", { name: "近くのスポット" })).toBeInTheDocument();
    await waitFor(() => expect(fetchNearby).toHaveBeenCalledWith({ lat: 35.65, lng: 139.75 }, "walk"));
    expect(screen.getAllByText("徒歩 約 6分")[0]).toBeInTheDocument();
    await waitFor(() => expect(latestPins).toEqual([expect.objectContaining({ id: "s1", type: "focus" }), expect.objectContaining({ id: "s2", type: "post" })]));

    // v3.2: 「移動手段」を車にすると mode=car で取り直す
    fireEvent.change(screen.getByRole("combobox", { name: "移動手段" }), { target: { value: "car" } });
    await waitFor(() => expect(fetchNearby).toHaveBeenLastCalledWith({ lat: 35.65, lng: 139.75 }, "car"));

    // 2 枚目までスクロールしたことにする（カード幅 176 + 間隔 10）
    // Bug #503: 中央のカードは各カードの実際の位置で決まるので、jsdom では矩形を差し替えて 2 枚目を中央に置く
    // Task3（2026-09-25）: カードはリンクではなくボタン（1 回目のタップは選ぶだけ）
    const scroller = screen.getByRole("button", { name: /展望台/ }).parentElement as HTMLElement;
    const rect = (left: number, width: number) => () => ({ left, width, right: left + width, top: 0, bottom: 0, height: 0, x: left, y: 0, toJSON: () => ({}) }) as DOMRect;
    scroller.getBoundingClientRect = rect(0, 390);
    Array.from(scroller.querySelectorAll<HTMLElement>("[data-nearby-card]")).forEach((card, index) => {
      card.getBoundingClientRect = rect(index === 1 ? 107 : -79, 176);
    });
    fireEvent.scroll(scroller);
    await waitFor(() => expect(latestPins).toEqual([expect.objectContaining({ id: "s1", type: "post" }), expect.objectContaining({ id: "s2", type: "focus" })]));
  });
});

describe("v3.1（mentoring-7 Task7）: 地図の状態の復元", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("idle のたびに中心・ズーム・入口を sessionStorage に保存する", async () => {
    render(<MapScreen open={resolveMapOpen({ spot: "spot-1", lat: "35.65", lng: "139.75", back: "/search?pref=大阪府" })} fetchPins={async () => []} resolveCenter={resolveCenter} />);
    await settle();
    const saved = JSON.parse(window.sessionStorage.getItem("tabikoe:map-state") ?? "null");
    expect(saved).toMatchObject({ entry: "spot:spot-1", mode: "spot", center: { lat: 35.65, lng: 139.75 }, zoom: 14 });
  });

  it("素の /map で開くと、直前の探すモード（中心・移動手段）を復元する", async () => {
    window.sessionStorage.setItem(
      "tabikoe:map-state",
      JSON.stringify({ entry: "explore", mode: "explore", center: { lat: 34.7, lng: 135.5 }, zoom: 15, travel: "bicycle", savedAt: Date.now() })
    );
    const fetchNearby = vi.fn(async () => []);
    render(<MapScreen open={resolveMapOpen({})} fetchPins={async () => []} resolveCenter={resolveCenter} fetchNearby={fetchNearby} />);
    await settle();
    expect(document.querySelector("[data-map-mode='explore']")).toBeInTheDocument();
    await waitFor(() => expect(fetchNearby).toHaveBeenCalledWith({ lat: 34.7, lng: 135.5 }, "bicycle"));
  });

  it("別の入口（他のスポットの地図）から開いたときは復元しない", async () => {
    window.sessionStorage.setItem(
      "tabikoe:map-state",
      JSON.stringify({ entry: "spot:other", mode: "spot", center: { lat: 1, lng: 2 }, zoom: 10, savedAt: Date.now() })
    );
    const fetchNearby = vi.fn(async () => []);
    render(<MapScreen open={resolveMapOpen({ spot: "spot-1", lat: "35.65", lng: "139.75" })} fetchPins={async () => []} resolveCenter={resolveCenter} fetchNearby={fetchNearby} />);
    await settle();
    expect(document.querySelector("[data-map-mode='spot']")).toBeInTheDocument();
    expect(fetchNearby).not.toHaveBeenCalled();
  });

  it("Task3（2026-09-25）: カードを選ぶと地図が動き、そのスポットの吹き出しが開く", async () => {
    const fetchNearby = vi.fn(async () => [
      { id: "p1", spotId: "s1", spotName: "カフェ", commentExcerpt: null, thumbnailUrl: null, lat: 35.651, lng: 139.751, distanceMeters: 100, walkMinutes: 2, minutes: 2, mode: "walk" as const },
      { id: "p2", spotId: "s9", spotName: "展望台", commentExcerpt: null, thumbnailUrl: null, lat: 35.652, lng: 139.752, distanceMeters: 300, walkMinutes: 5, minutes: 5, mode: "walk" as const },
    ]);
    render(<MapScreen open={resolveMapOpen({ mode: "explore", lat: "35.65", lng: "139.75" })} fetchPins={async () => [pin("s2")]} fetchNearby={fetchNearby} resolveCenter={resolveCenter} />);
    await settle();
    await screen.findByRole("heading", { name: "近くのスポット" });
    // 最初のカードは自動で選ばれ、その吹き出しが出る
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    // 2 枚目を選ぶと吹き出しがそのスポットに変わる
    fireEvent.click(screen.getByRole("button", { name: /展望台/ }));
    // ピンがまだ無いスポットでも、カードの情報だけで吹き出しを出す
    await waitFor(() => expect(screen.getByRole("dialog", { name: "展望台" })).toBeInTheDocument());
  });

  it("Bug #511: 投稿一覧から戻ったとき、地図は保存した位置・現在地は取り直した今いる場所・カードはそのまま", async () => {
    // 保存された状態: 地図の中心はスポット（s9）、開いたときの現在地は 35.65/139.75、選んでいたカードは s9
    window.sessionStorage.setItem(
      "tabikoe:map-state",
      JSON.stringify({
        entry: "explore",
        mode: "explore",
        center: { lat: 35.652, lng: 139.752 },
        zoom: 16,
        travel: "walk",
        openedAt: { lat: 35.65, lng: 139.75 },
        activeSpotId: "s9",
        savedAt: Date.now(),
      })
    );
    const nearby = [
      { id: "p1", spotId: "s1", spotName: "カフェ", commentExcerpt: null, thumbnailUrl: null, lat: 35.651, lng: 139.751, distanceMeters: 100, walkMinutes: 2, minutes: 2, mode: "walk" as const },
      { id: "p2", spotId: "s9", spotName: "展望台", commentExcerpt: null, thumbnailUrl: null, lat: 35.652, lng: 139.752, distanceMeters: 300, walkMinutes: 5, minutes: 5, mode: "walk" as const },
    ];
    const fetchNearby = vi.fn<(center: { lat: number; lng: number }, mode: string) => Promise<typeof nearby>>(async () => nearby);
    // 戻ってきたときの位置情報の取り直し（少し歩いた位置が返る）
    const relocated = { lat: 35.6505, lng: 139.7505 };
    const resolveCurrent = () => Promise.resolve({ center: relocated, zoom: 16, source: "current" as const });
    render(
      <MapScreen open={resolveMapOpen({ mode: "explore", lat: "35.65", lng: "139.75" })} fetchPins={async () => []} fetchNearby={fetchNearby} resolveCenter={resolveCurrent} />
    );
    await settle();
    // 近くのスポットは「取り直した現在地」で取り直す（スポットの位置ではない）
    await waitFor(() => expect(fetchNearby).toHaveBeenLastCalledWith(relocated, "walk"));
    expect(fetchNearby.mock.calls.every((call) => call[0].lat !== 35.652)).toBe(true);
    // 選んでいたカードはそのまま
    await waitFor(() => expect(document.querySelector("[data-nearby-card=\"p2\"]")).toHaveAttribute("aria-current", "true"));
    window.sessionStorage.clear();
  });
});
