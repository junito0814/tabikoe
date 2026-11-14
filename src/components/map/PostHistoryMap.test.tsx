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
// map-current-location Task1: 投稿履歴には現在地を出さない（要件定義書 4.5.10）
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

/*
 * #1074: 既定の「現在地の取り方」が何回呼ばれたかを数える。
 * 本物の resolveInitialCenter（位置情報を取る）だけを差し替え、ほかの値（拡大率など）はそのまま使う。
 * ほかのテストは resolveCenter を自分で渡しているので、この差し替えの影響を受けない。
 */
const resolveInitialCenterMock = vi.fn(async () => ({
  center: { lat: 35.6812, lng: 139.7671 },
  zoom: 13,
  source: "current" as const,
}));
vi.mock("./initial-center", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./initial-center")>()),
  resolveInitialCenter: () => resolveInitialCenterMock(),
}));

import { PostHistoryMap } from "./PostHistoryMap";

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
  category: null,
  isWishlisted: kind === "saved",
});

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  push.mockClear();
});

describe("PostHistoryMap（SC-12）", () => {
  it("表示切り替えに応じて mode が both → posted → saved と切り替わる", async () => {
    const fetchPins = vi.fn(async () => []);
    render(<PostHistoryMap fetchPins={fetchPins} resolveCenter={resolveCenter} />);
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

    fireEvent.click(screen.getByRole("radio", { name: "行きたいのみ" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    await waitFor(() => expect(fetchPins).toHaveBeenLastCalledWith("saved", BOUNDS));
    expect(screen.getByRole("radio", { name: "行きたいのみ" })).toHaveAttribute("aria-checked", "true");
  });

  it("投稿済みは posted で投稿詳細へ、保存済みは saved で一覧へ、下書きは draft で続きを書くへ", async () => {
    render(
      <PostHistoryMap
        fetchPins={async () => [pin("s-posted", "posted", "post-1"), pin("s-saved", "saved", null), pin("s-draft", "draft", "d1")]}
        resolveCenter={resolveCenter}
      />
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    fireEvent.click(await screen.findByRole("button", { name: "s-posted:posted" }));
    // Bug #471: 「← 投稿履歴」で戻れるよう back を付ける
    expect(push).toHaveBeenCalledWith("/posts/post-1?back=%2Fpost-history");
    fireEvent.click(screen.getByRole("button", { name: "s-saved:saved" }));
    expect(push).toHaveBeenCalledWith("/spots/s-saved?back=%2Fpost-history");
    fireEvent.click(screen.getByRole("button", { name: "draft:d1:draft" }));
    expect(push).toHaveBeenCalledWith("/posts/new?draft=d1");
  });

  it("投稿履歴には現在地の点を出さない（4.5.10。自分の記録を見る画面なので）", async () => {
    render(<PostHistoryMap fetchPins={async () => []} resolveCenter={resolveCenter} />);
    await screen.findByTestId("map-stub");
    expect(latestCurrentLocation ?? null).toBeNull();
  });
});

describe("loading-feedback Task 2: 読み込み中に「ありません」と言わない", () => {
  const EMPTY = "この範囲に表示できるスポットはありません";
  const LOADING = "読み込んでいます…";

  it("取得が終わるまでは「ありません」を出さず「読み込んでいます…」を出す", async () => {
    let resolvePins: ((pins: never[]) => void) | null = null;
    const fetchPins = vi.fn(() => new Promise<never[]>((resolve) => { resolvePins = resolve; }));
    render(<PostHistoryMap fetchPins={fetchPins} resolveCenter={resolveCenter} />);
    await screen.findByTestId("map-stub");

    // デバウンスで待っている間も「取得中」として扱う（地図が範囲を知らせるのを待ってから見る）
    expect(await screen.findByText(LOADING)).toBeInTheDocument();
    expect(screen.queryByText(EMPTY)).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    // 通信中もまだ言わない
    expect(screen.queryByText(EMPTY)).not.toBeInTheDocument();

    await act(async () => {
      resolvePins?.([]);
    });
    // 取り終えて 0 件だったので、ここで初めて出す
    await waitFor(() => expect(screen.getByText(EMPTY)).toBeInTheDocument());
    expect(screen.queryByText(LOADING)).not.toBeInTheDocument();
  });

  it("ピンが返ってきたらどちらの文言も出さない", async () => {
    const fetchPins = vi.fn(async () => [pin("s1", "posted", "p1")]);
    render(<PostHistoryMap fetchPins={fetchPins} resolveCenter={resolveCenter} />);
    await screen.findByTestId("map-stub");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    await waitFor(() => expect(screen.queryByText(LOADING)).not.toBeInTheDocument());
    expect(screen.queryByText(EMPTY)).not.toBeInTheDocument();
  });

  it("表示を切り替えた直後も「ありません」を出さない（取り直している最中のため）", async () => {
    const fetchPins = vi.fn(async () => []);
    render(<PostHistoryMap fetchPins={fetchPins} resolveCenter={resolveCenter} />);
    await screen.findByTestId("map-stub");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    await waitFor(() => expect(screen.getByText(EMPTY)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("radio", { name: "投稿のみ" }));
    // 切り替えた瞬間に「読み込んでいます…」へ戻る
    expect(await screen.findByText(LOADING)).toBeInTheDocument();
    expect(screen.queryByText(EMPTY)).not.toBeInTheDocument();
  });

  it("取得に失敗したときは今までどおりエラー表示になり、どちらの文言も出さない", async () => {
    const fetchPins = vi.fn(async () => {
      throw new Error("down");
    });
    render(<PostHistoryMap fetchPins={fetchPins} resolveCenter={resolveCenter} />);
    await screen.findByTestId("map-stub");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    await waitFor(() => expect(screen.queryByText(LOADING)).not.toBeInTheDocument());
    expect(screen.queryByText(EMPTY)).not.toBeInTheDocument();
  });
});

/**
 * 出典: Issue #1074「投稿履歴の地図が、現在地を取り直して描き直し続ける見込み」
 *
 * 【初心者向け】既定の resolveCenter が描くたびに新しい関数になっていたので、
 * 「現在地を取る → 自分の状態（初期位置）を書き換えて描き直す → また現在地を取る」が止まらなかった。
 * #1071 の投稿画面と違い、親が描き直さなくても**自分だけで回る**。
 * resolveCenter を渡さずに（＝本番と同じ既定値で）描き、現在地を取るのが 1 回だけであることを固定する。
 */
describe("現在地を取るのは 1 回だけ（#1074）", () => {
  it("既定の取り方のとき、初期位置が決まったあとに現在地を取り直さない", async () => {
    resolveInitialCenterMock.mockClear();
    const fetchPins = vi.fn(async () => []);
    render(<PostHistoryMap fetchPins={fetchPins} />);
    await screen.findByTestId("map-stub");
    // 少し待っても、2 回目は来ない（循環していない）
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(resolveInitialCenterMock).toHaveBeenCalledTimes(1);
  });
});
