import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PostSearchScreen } from "./PostSearchScreen";
import { buildPostSearchParams, EMPTY_SEARCH_STATE } from "./post-search-query";

/**
 * 出典: docs/tasks/map-search/post-filter/02-filter-ui.md 単体テスト
 * - 絞り込み条件の選択状態がTask1へのリクエストパラメータに正しく反映されることを検証する
 */
const center = { lat: 35.6812, lng: 139.7671 };
const empty = { posts: [], nextOffset: null };

describe("buildPostSearchParams", () => {
  it("選択した条件だけをクエリに載せる", () => {
    const params = buildPostSearchParams(
      { keyword: " 東京駅 ", categories: ["グルメ", "観光スポット"], distance: 1000, cost: "3000", duration: "1時間以内" },
      center,
      20
    );
    expect(Object.fromEntries(params)).toEqual({
      q: "東京駅",
      categories: "グルメ,観光スポット",
      distance: "1000",
      lat: "35.6812",
      lng: "139.7671",
      cost: "3000",
      duration: "1時間以内",
      offset: "20",
    });
  });

  it("条件なしなら空、距離は中心座標が無ければ送らない", () => {
    expect(buildPostSearchParams(EMPTY_SEARCH_STATE, center, 0).toString()).toBe("");
    const params = buildPostSearchParams({ ...EMPTY_SEARCH_STATE, distance: 500 }, null, 0);
    expect(params.has("distance")).toBe(false);
    expect(params.has("lat")).toBe(false);
  });
});

describe("PostSearchScreen（SC-04 絞り込み）", () => {
  it("キーワード・カテゴリ・距離・費用・滞在時間の選択がリクエストに反映される", async () => {
    const fetchPage = vi.fn<(params: URLSearchParams) => Promise<typeof empty>>(async () => empty);
    render(<PostSearchScreen center={center} initialPage={empty} fetchPage={fetchPage} />);

    fireEvent.change(screen.getByRole("searchbox", { name: "キーワード（スポット名）" }), {
      target: { value: "東京駅" },
    });
    fireEvent.click(screen.getByRole("button", { name: "絞り込み" }));
    fireEvent.click(screen.getByLabelText("グルメ"));
    fireEvent.click(screen.getByLabelText("宿泊施設"));
    fireEvent.click(screen.getByLabelText("1km以内"));
    fireEvent.click(screen.getByLabelText("〜3,000円"));
    fireEvent.click(screen.getByLabelText("2時間以内"));
    fireEvent.click(screen.getByRole("button", { name: "この条件で検索" }));

    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(1));
    const params = fetchPage.mock.calls[0][0];
    expect(Object.fromEntries(params)).toEqual({
      q: "東京駅",
      categories: "グルメ,宿泊施設",
      distance: "1000",
      lat: "35.6812",
      lng: "139.7671",
      cost: "3000",
      duration: "2時間以内",
    });
  });

  it("中心座標が無い場合は距離の選択肢が無効", () => {
    render(<PostSearchScreen center={null} initialPage={empty} fetchPage={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "絞り込み" }));
    expect(screen.getByLabelText("500m以内")).toBeDisabled();
  });

  it("「もっと見る」は適用中の条件に offset を付けて読む", async () => {
    const fetchPage = vi.fn<(params: URLSearchParams) => Promise<typeof empty>>(async () => empty);
    render(<PostSearchScreen center={center} initialPage={{ posts: [], nextOffset: 20 }} fetchPage={fetchPage} />);
    fireEvent.click(screen.getByRole("button", { name: "もっと見る" }));
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(1));
    expect(Object.fromEntries(fetchPage.mock.calls[0][0])).toEqual({ offset: "20" });
  });
});
