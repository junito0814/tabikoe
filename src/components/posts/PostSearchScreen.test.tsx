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
 * - 並び替え（<select>）で選択が表示に反映されること
 * - #681: 距離の絞り込みは出ない（地図タブに置き換え）
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
  latestComment: null,
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
    // #692（2026-10-05）: 「徒歩 N 分」は外した（位置情報の取得を待つぶん一覧が遅れていた）
    expect(article).not.toHaveTextContent("徒歩");
    expect(article).toHaveTextContent("たこ焼き〇〇");
    // #680（2026-10-05）: ラベルは廃止（決定事項 70）
    expect(article).not.toHaveTextContent("タビコエだけの場所");
    expect(article).toHaveTextContent("外はカリッと中はとろとろ");
    // #692: 「星4」の文字は外し、★ の数だけにした（読み上げ用の名前は残る）
    expect(article).not.toHaveTextContent("星4");
    expect(article.querySelector('[aria-label="星4"]')).toBeInTheDocument();
    expect(article).toHaveTextContent("¥1,200/人");
    expect(article).toHaveTextContent("グルメ");
    expect(article).toHaveTextContent("9月にまだあった");
    // v3.1: カードの「地図で見る」ボタンは廃止（上 1/3 の地図が兼ねる）
    expect(screen.queryByRole("link", { name: "地図で見る" })).toBeNull();
    // v3.2: コメントが無ければプレビューは出ない
    expect(document.querySelector("[data-comment-preview]")).toBeNull();
    expect(screen.getByRole("button", { name: "行きたい" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "コメント 3 件" })).toHaveAttribute("href", "/posts/p1#comments");
    expect(screen.getByRole("link", { name: "たこ焼き〇〇の写真 1" })).toHaveAttribute("href", "/posts/p1"); // v3.1: カードの写真は投稿詳細へ直接
  });

  it("徒歩分・まだあった報告が無ければ描画しない", () => {
    renderScreen({ initialPage: { posts: [card("p1", { walkMinutes: null, latestStatus: null })], nextOffset: null } });
    const article = document.querySelector("[data-post-card='p1']") as HTMLElement;
    expect(article).not.toHaveTextContent("徒歩");
    expect(article.querySelector("[data-spot-status]")).toBeNull();
  });

  it("並び替えは <select> で、選ぶと表示が変わり URL と一覧を更新する", async () => {
    const fetchPage = renderScreen();
    // #812: 自前のリストをやめ、ブラウザ標準の <select> になった
    fireEvent.change(screen.getByRole("combobox", { name: "並び替え" }), { target: { value: "rating" } });
    expect(screen.getByRole("combobox", { name: "並び替え" })).toHaveValue("rating");
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(1));
    expect(Object.fromEntries(fetchPage.mock.calls[0][0])).toEqual({ pref: "大阪府", sort: "rating" });
    expect(replace).toHaveBeenCalledWith("/search?pref=%E5%A4%A7%E9%98%AA%E5%BA%9C&sort=rating", { scroll: false });
  });

  it("Bug #483: 戻り先（back）があるときは、並び替え・写真切替で URL を書き換えても back を保つ", async () => {
    renderScreen({ context: { destination: { kind: "spot", spotId: "spot-1" } }, title: "東京駅", backHref: "/search?pref=東京都", backLabel: "東京都", backParam: "/search?pref=東京都" });
    fireEvent.change(screen.getByRole("combobox", { name: "並び替え" }), { target: { value: "rating" } });
    await waitFor(() => expect(replace).toHaveBeenCalled());
    const url = new URL(String(replace.mock.calls[0][0]), "https://example.com");
    expect(url.searchParams.get("sort")).toBe("rating");
    expect(url.searchParams.get("back")).toBe("/search?pref=東京都");
    fireEvent.click(screen.getByRole("radio", { name: "写真" }));
    const url2 = new URL(String(replace.mock.calls[replace.mock.calls.length - 1][0]), "https://example.com");
    expect(url2.searchParams.get("view")).toBe("photos");
    expect(url2.searchParams.get("back")).toBe("/search?pref=東京都");
  });

  it("絞り込みシートの選択がリクエストに反映され、件数がボタンに出る", async () => {
    const fetchPage = renderScreen({ context: nearby, title: "東京駅" });
    fireEvent.click(screen.getByRole("button", { name: "絞り込み" }));
    fireEvent.click(screen.getByLabelText("グルメ"));
    fireEvent.click(screen.getByLabelText("宿泊施設"));
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
      cost: "3000",
      duration: "2時間以内",
      period: "this_month",
    });
    expect(screen.getByRole("button", { name: "絞り込み（4）" })).toBeInTheDocument();
  });

  /** #681（2026-10-05）: 距離は廃止した（地図タブに置き換え。要件 3.4.2） */
  it("距離の絞り込みは出ない（基準点があっても）", () => {
    renderScreen({ context: nearby, title: "東京駅" });
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
      items: [{ id: "m1", postId: "p1", mediaType: "photo" as const, thumbnailUrl: "https://example.com/m1.jpg", videoUrl: null, alt: "たこ焼き〇〇の写真 1", postedAt: "2026-09-01T00:00:00Z", info: { spotName: "たこ焼き〇〇", isManualSpot: true, rating: 4, duration: "30分以内", cost: 1200, authorName: "たろう", visitDate: "2026-09-03" } }],
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

describe("PostCard（v3.2: コメントのプレビュー）", () => {
  it("コメントがあれば最新 1 件と「コメント N 件をすべて見る」が出て、投稿詳細のコメント欄へのリンク", () => {
    const item = card("p1", { commentCount: 3, latestComment: { authorName: "けんた", excerpt: "行列すごかった" } });
    render(<PostSearchScreen context={{ destination: { kind: "spot", spotId: "spot-1" } }} initialState={EMPTY_SEARCH_STATE} initialPage={{ posts: [item], nextOffset: null }} title="たこ焼き〇〇" backHref="/" backLabel="ホーム" />);
    const preview = document.querySelector("[data-comment-preview]") as HTMLElement;
    expect(preview).toHaveTextContent("けんた 行列すごかった");
    expect(preview).toHaveTextContent("コメント 3 件をすべて見る");
    expect(preview).toHaveAttribute("href", "/posts/p1#comments");
  });
});

describe("loading-feedback Task 3: 条件を変えたら古い一覧を残さない", () => {
  const filled = { posts: [card("p1")], nextOffset: null };

  it("並び替えを変えた直後に古いカードが消え、骨組みが出る", async () => {
    let resolvePage: (page: typeof empty) => void = () => {};
    const fetchPage = vi.fn(() => new Promise<typeof empty>((resolve) => { resolvePage = resolve; }));
    render(
      <PostSearchScreen
        context={pref}
        initialState={EMPTY_SEARCH_STATE}
        initialPage={filled}
        title="大阪府"
        backHref="/"
        backLabel="ホーム"
        fetchPage={fetchPage}
      />
    );
    // 最初は 1 件出ている
    expect(screen.getByText("たこ焼き〇〇")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "並び替え" }), { target: { value: "rating" } });

    // 古いカードは残らず、読み込んでいることが分かる
    await waitFor(() => expect(screen.queryByText("たこ焼き〇〇")).not.toBeInTheDocument());
    expect(screen.getByRole("status", { name: "読み込んでいます" })).toBeInTheDocument();
    // 条件を変えただけなのに「ありません」とは言わない
    expect(screen.queryByText("条件に合う投稿がありません")).not.toBeInTheDocument();

    resolvePage({ posts: [], nextOffset: null });
    await waitFor(() => expect(screen.getByText("条件に合う投稿がありません")).toBeInTheDocument());
  });
});

/*
 * #675（2026-10-04）: スポット別の投稿一覧に「引っ張って更新」を付けない
 * 出典: 要件定義書 4.5.11 の場面 6・受入条件 96
 *
 * 【初心者向け】この画面は上 1/3 が地図＋下 2/3 がシートで、ページ全体が
 * 「地図とシートのどちらかに吸い付く」作り。いちばん上で下に引く動きは
 * **すでに「地図を出す」の意味**を持っているので、引っ張って更新は付けない。
 * 実際、一覧を読む姿勢（少しでもスクロールした状態）では歯車は出なかった。
 */
describe("#675: 引っ張って更新は付けない", () => {
  it("PullToRefresh で包まない", async () => {
    render(
      <PostSearchScreen
        context={{ destination: { kind: "spot", spotId: "s1" } }}
        initialState={EMPTY_SEARCH_STATE}
        initialPage={{ posts: [], nextOffset: null }}
        title="たこ焼き〇〇"
        backHref="/"
        backLabel="ホーム"
      />
    );
    expect(document.querySelector("[data-pull-to-refresh]")).toBeNull();
  });
});

/**
 * #692（2026-10-05）: スポット別の一覧（1 つの場所の中）では、絞り込みと「＋」を出さない。
 * 絞り込みは「1 つの場所の中で予算や評価で絞る」場面が無く、「＋」は保存先がスポット単位なので
 * 見出しの 1 つで足りる。並び替えは残す。
 */
describe("スポット別の一覧（#692）", () => {
  const spotContext = { destination: { kind: "spot" as const, spotId: "s1" }, addMode: null };

  it("絞り込みは出さず、並び替えは残す", () => {
    renderScreen({ initialPage: { posts: [card("p1")], nextOffset: null }, context: spotContext });
    expect(screen.queryByRole("button", { name: /絞り込み/ })).toBeNull();
    expect(screen.getByRole("combobox", { name: /並び替え/ })).toBeInTheDocument();
  });

  it("投稿カードに「＋」を出さない", () => {
    renderScreen({ initialPage: { posts: [card("p1")], nextOffset: null }, context: spotContext });
    expect(screen.queryByRole("button", { name: "行きたい" })).toBeNull();
  });

  it("検索結果（スポット別でない）では今までどおり両方出す", () => {
    renderScreen({ initialPage: { posts: [card("p1")], nextOffset: null } });
    expect(screen.getByRole("button", { name: /絞り込み/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "行きたい" })).toBeInTheDocument();
  });
});
