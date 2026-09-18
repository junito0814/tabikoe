import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }) }));

import { PostSearchScreen } from "./PostSearchScreen";
import { EMPTY_SEARCH_STATE, type SearchContext } from "./post-search-query";
import type { PostCardData } from "@/lib/posts/post-cards";
import type { SpotMediaItem } from "@/lib/posts/search-photos";
import { saveListState } from "@/lib/search/list-state";

/**
 * 出典: docs/tasks/map-search/post-timeline/02-timeline-ui.md 単体テスト
 * - カードに必須要素がすべて描画されること
 * - 並び替えドロップダウンで選択がボタン表示に反映されること
 * - 基準点が無いとき距離の絞り込みが出ないこと
 * 出典: docs/tasks/map-search/post-timeline/03-scroll-and-back.md 単体テスト
 * - 保存した状態が URL キーで復元されること
 * 出典: docs/tasks/map-search/post-filter/02-filter-ui.md 単体テスト
 * - 絞り込み条件の選択状態がリクエストパラメータに正しく反映されること
 */
const nearby: SearchContext = { destination: { kind: "nearby", lat: 35.6812, lng: 139.7671, label: "東京駅" } };
const pref: SearchContext = { destination: { kind: "prefecture", name: "大阪府" } };
const empty: { posts: PostCardData[]; nextOffset: number | null } = { posts: [], nextOffset: null };

const card = (id: string, overrides: Partial<PostCardData> = {}): PostCardData => ({
  id,
  spotId: "spot-1",
  spotName: "たこ焼き〇〇",
  category: "グルメ",
  visitDate: "2026-09-03",
  duration: "1時間以内",
  cost: 1200,
  rating: 4,
  commentExcerpt: "外はカリッと中はとろとろ",
  createdAt: "2026-09-04T00:00:00Z",
  author: { id: "u1", displayName: "たろう", avatarUrl: "/default-avatar.svg" },
  thumbnailUrl: "https://example.com/p.jpg",
  thumbnailMediaType: "photo",
  mediaCount: 1,
  media: [{ id: "m1", mediaType: "photo", thumbnailUrl: "https://example.com/p.jpg", alt: "たこ焼き〇〇の写真 1" }],
  likeCount: 12,
  commentCount: 3,
  viewerHasLiked: false,
  viewerHasSaved: false,
  isManualSpot: true,
  prefecture: "大阪府",
  spotLat: 34.7,
  spotLng: 135.5,
  walkMinutes: 8,
  latestStatus: { status: "still_there", reportedAt: "2026-09-10T00:00:00Z" },
  ...overrides,
});

function renderScreen(props: Partial<Parameters<typeof PostSearchScreen>[0]> = {}) {
  const fetchPage = vi.fn<(params: URLSearchParams) => Promise<{ posts: PostCardData[]; nextOffset: number | null }>>(async () => empty);
  render(
    <PostSearchScreen
      context={pref}
      initialState={EMPTY_SEARCH_STATE}
      initialPage={empty}
      title="大阪府"
      backHref="/"
      backLabel="ホーム"
      fetchPage={fetchPage}
      {...props}
    />
  );
  return fetchPage;
}

beforeEach(() => {
  replace.mockClear();
  window.sessionStorage.clear();
});

describe("PostSearchScreen（SC-04 タイムライン）", () => {
  it("カードに必須要素がすべて描画される", () => {
    renderScreen({ initialPage: { posts: [card("p1")], nextOffset: null } });
    const article = document.querySelector("[data-post-card='p1']") as HTMLElement;
    expect(article).toHaveTextContent("たろう");
    expect(article).toHaveTextContent("訪問 9/3");
    expect(article).toHaveTextContent("徒歩 8分");
    expect(article).toHaveTextContent("たこ焼き〇〇");
    expect(article).toHaveTextContent("タビコエだけの場所");
    expect(article).toHaveTextContent("外はカリッと中はとろとろ");
    expect(article).toHaveTextContent("星4");
    expect(article).toHaveTextContent("¥1,200/人");
    expect(article).toHaveTextContent("グルメ");
    expect(article).toHaveTextContent("9月にまだあった");
    const mapHref = new URL(screen.getByRole("link", { name: "地図で見る" }).getAttribute("href") ?? "", "https://example.com");
    expect(mapHref.pathname).toBe("/map");
    expect(mapHref.searchParams.get("spot")).toBe("spot-1");
    expect(mapHref.searchParams.get("lat")).toBe("34.7");
    // back には今の一覧の URL が入る（「一覧に戻る」用）
    expect(mapHref.searchParams.get("back")).toBe("/search?pref=%E5%A4%A7%E9%98%AA%E5%BA%9C");
    expect(screen.getByRole("button", { name: "保存する" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "コメント3件" })).toHaveAttribute("href", "/posts/p1#comments");
    expect(screen.getByRole("button", { name: "たこ焼き〇〇の写真 1" })).toBeInTheDocument();
  });

  it("徒歩分・まだあった報告が無ければ描画しない", () => {
    renderScreen({ initialPage: { posts: [card("p1", { walkMinutes: null, latestStatus: null })], nextOffset: null } });
    const article = document.querySelector("[data-post-card='p1']") as HTMLElement;
    expect(article).not.toHaveTextContent("徒歩");
    expect(article.querySelector("[data-spot-status]")).toBeNull();
  });

  it("並び替えはドロップダウンで、選ぶとボタン表示が変わり URL と一覧を更新する", async () => {
    const fetchPage = renderScreen();
    fireEvent.click(screen.getByRole("button", { name: "並び替え: 新着順" }));
    fireEvent.click(screen.getByRole("option", { name: "評価順" }));
    expect(screen.getByRole("button", { name: "並び替え: 評価順" })).toBeInTheDocument();
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(1));
    expect(Object.fromEntries(fetchPage.mock.calls[0][0])).toEqual({ pref: "大阪府", sort: "rating" });
    expect(replace).toHaveBeenCalledWith("/search?pref=%E5%A4%A7%E9%98%AA%E5%BA%9C&sort=rating", { scroll: false });
  });

  it("絞り込みシートの選択がリクエストに反映され、件数がボタンに出る", async () => {
    const fetchPage = renderScreen({ context: nearby, title: "東京駅" });
    fireEvent.click(screen.getByRole("button", { name: "絞り込み" }));
    fireEvent.click(screen.getByLabelText("グルメ"));
    fireEvent.click(screen.getByLabelText("宿泊施設"));
    fireEvent.click(screen.getByLabelText("1km以内"));
    fireEvent.click(screen.getByLabelText("〜3,000円"));
    fireEvent.click(screen.getByLabelText("2時間以内"));
    fireEvent.click(screen.getByLabelText("今月"));
    fireEvent.click(screen.getByRole("button", { name: "この条件で表示" }));

    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(1));
    expect(Object.fromEntries(fetchPage.mock.calls[0][0])).toEqual({
      lat: "35.6812",
      lng: "139.7671",
      q: "東京駅",
      categories: "グルメ,宿泊施設",
      distance: "1000",
      cost: "3000",
      duration: "2時間以内",
      period: "this_month",
    });
    expect(screen.getByRole("button", { name: "絞り込み（5）" })).toBeInTheDocument();
  });

  it("基準点が無いとき距離の絞り込みは出ない", () => {
    renderScreen({ context: pref });
    fireEvent.click(screen.getByRole("button", { name: "絞り込み" }));
    expect(screen.queryByLabelText("1km以内")).toBeNull();
    expect(screen.getByLabelText("〜3,000円")).toBeInTheDocument();
  });

  it("「もっと見る」で nextOffset から追加読み込みする", async () => {
    const fetchPage = vi.fn<(params: URLSearchParams) => Promise<{ posts: PostCardData[]; nextOffset: number | null }>>(async () => ({ posts: [card("p21")], nextOffset: null }));
    renderScreen({ initialPage: { posts: [card("p1")], nextOffset: 20 }, fetchPage });
    fireEvent.click(screen.getByRole("button", { name: "もっと見る" }));
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(1));
    expect((fetchPage.mock.calls[0][0]).get("offset")).toBe("20");
    expect(document.querySelector("[data-post-card='p21']")).toBeInTheDocument();
  });

  it("保存した状態が URL キーで復元される（同じページ数まで読み込み直す）", async () => {
    saveListState("/search?pref=%E5%A4%A7%E9%98%AA%E5%BA%9C", { scrollY: 800, loadedPages: 2 });
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const fetchPage = vi.fn<(params: URLSearchParams) => Promise<{ posts: PostCardData[]; nextOffset: number | null }>>(async () => ({ posts: [card("p21")], nextOffset: null }));
    renderScreen({ initialPage: { posts: [card("p1")], nextOffset: 20 }, fetchPage });
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(1));
    expect((fetchPage.mock.calls[0][0]).get("offset")).toBe("20");
    await waitFor(() => expect(document.querySelector("[data-post-card='p21']")).toBeInTheDocument());
    await waitFor(() => expect(scrollTo).toHaveBeenCalledWith({ top: 800 }));
    scrollTo.mockRestore();
  });

  it("追加モードならバナーが出て「完了」でしおりへ戻る", () => {
    renderScreen({ addMode: { itineraryId: "it-1", day: 2, title: "大阪旅行", spotIds: [] } });
    expect(screen.getByRole("status")).toHaveTextContent("大阪旅行");
    expect(screen.getByRole("status")).toHaveTextContent("Day 2 に追加中");
    expect(screen.getByRole("link", { name: "完了" })).toHaveAttribute("href", "/itineraries/it-1");
  });

  it("「写真」に切り替えると URL に view=photos が付き、グリッドが描画される", async () => {
    const fetchMediaPage = vi.fn<(params: URLSearchParams) => Promise<{ items: SpotMediaItem[]; nextOffset: number | null }>>(async () => ({
      items: [{ id: "m1", postId: "p1", mediaType: "photo" as const, thumbnailUrl: "https://example.com/m1.jpg", videoUrl: null, alt: "たこ焼き〇〇の写真 1", postedAt: "2026-09-01T00:00:00Z" }],
      nextOffset: null,
    }));
    renderScreen({
      initialPage: { posts: [card("p1")], nextOffset: null },
      fetchMediaPage,
      initialMediaPage: { key: "pref=%E5%A4%A7%E9%98%AA%E5%BA%9C", page: { items: [], nextOffset: 0 } },
    });
    fireEvent.click(screen.getByRole("radio", { name: "写真" }));
    expect(replace).toHaveBeenCalledWith("/search?pref=%E5%A4%A7%E9%98%AA%E5%BA%9C&view=photos", { scroll: false });
    expect(document.querySelector("[data-photo-grid]")).toBeInTheDocument();
    expect(document.querySelector("[data-post-card='p1']")).toBeNull();
    // 1 ページ目が未取得なら「もっと見る」で同じ条件（offset=0）を取りに行く
    fireEvent.click(screen.getByRole("button", { name: "もっと見る" }));
    await waitFor(() => expect(fetchMediaPage).toHaveBeenCalledTimes(1));
    expect(Object.fromEntries(fetchMediaPage.mock.calls[0][0])).toEqual({ pref: "大阪府", offset: "0" });
    expect(await screen.findByRole("button", { name: "たこ焼き〇〇の写真 1" })).toBeInTheDocument();
    // 「投稿」に戻すと一覧が残っている
    fireEvent.click(screen.getByRole("radio", { name: "投稿" }));
    expect(document.querySelector("[data-post-card='p1']")).toBeInTheDocument();
  });
});
