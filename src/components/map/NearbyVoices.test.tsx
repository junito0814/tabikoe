import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { centeredCardIndex, NearbyVoices } from "./NearbyVoices";
import type { NearbyPost } from "@/lib/posts/nearby-posts";
import { EMPTY_SPOT_FILTERS } from "@/lib/map/spot-aggregate";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }) }));

/**
 * 出典: docs/tasks/map-search/map-restore/（Bug #503）単体テスト
 * - 中央にいちばん近いカードを選ぶ。右端まで送ったら最後のカードが選ばれる
 * - 移動手段の選択肢が 5 つ（徒歩・自転車・車・電車・バス）
 */
const post = (id: string): NearbyPost => ({
  id,
  spotId: `s-${id}`,
  spotName: `スポット ${id}`,
  commentExcerpt: null,
  thumbnailUrl: null,
  lat: 35.68,
  lng: 139.76,
  distanceMeters: 100,
  walkMinutes: 2,
  minutes: 2,
  mode: "walk",
});

/** jsdom は位置を持たないので、スクロール領域とカードの矩形を差し替える */
function stubLayout(scrollerWidth: number, cardLefts: number[]) {
  const scroller = document.querySelector("[data-nearby-voices] div.overflow-x-auto") as HTMLElement;
  scroller.getBoundingClientRect = () => ({ left: 0, width: scrollerWidth, right: scrollerWidth, top: 0, bottom: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) });
  const cards = Array.from(scroller.querySelectorAll<HTMLElement>("[data-nearby-card]"));
  cards.forEach((card, index) => {
    const left = cardLefts[index];
    card.getBoundingClientRect = () => ({ left, width: 176, right: left + 176, top: 0, bottom: 0, height: 0, x: left, y: 0, toJSON: () => ({}) });
  });
  return scroller;
}

describe("centeredCardIndex（Bug #503）", () => {
  it("中央にいちばん近いカードを選ぶ。右端まで送れば最後のカードになる", () => {
    const rect = (left: number, width: number) => () => ({ left, width, right: left + width, top: 0, bottom: 0, height: 0, x: left, y: 0, toJSON: () => ({}) }) as DOMRect;
    const make = (lefts: number[]) =>
      ({
        getBoundingClientRect: rect(0, 390),
        querySelectorAll: () => lefts.map((left) => ({ getBoundingClientRect: rect(left, 176) })) as unknown as NodeListOf<HTMLElement>,
      }) as unknown as Parameters<typeof centeredCardIndex>[0];
    // 先頭が中央（左端にスクロール）
    expect(centeredCardIndex(make([107, 293, 479]))).toBe(0);
    // 右端まで送った状態（最後のカードの中心が 195 に近い）
    expect(centeredCardIndex(make([-265, -79, 107]))).toBe(2);
    // カードが無ければ null
    expect(centeredCardIndex(make([]))).toBeNull();
  });
});

describe("NearbyVoices（近くのスポット）", () => {
  it("移動手段は 徒歩・自転車・車・電車・バス の 5 つ", async () => {
    render(<NearbyVoices center={{ lat: 35.68, lng: 139.76 }} fetchPosts={async () => [post("a")]} />);
    await waitFor(() => expect(screen.getByRole("combobox", { name: "移動手段" })).toBeInTheDocument());
    expect(Array.from(screen.getByRole("combobox", { name: "移動手段" }).querySelectorAll("option")).map((o) => o.textContent)).toEqual(["徒歩", "自転車", "車", "電車", "バス"]);
  });

  it("スクロールすると中央のカードを親に知らせる（右端でも最後のカードになる）", async () => {
    const onActiveChange = vi.fn();
    render(<NearbyVoices center={{ lat: 35.68, lng: 139.76 }} fetchPosts={async () => [post("a"), post("b"), post("c")]} onActiveChange={onActiveChange} />);
    await waitFor(() => expect(document.querySelectorAll("[data-nearby-card]")).toHaveLength(3));
    const scroller = stubLayout(390, [-265, -79, 107]);
    scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
    await waitFor(() => expect(onActiveChange).toHaveBeenCalledWith(expect.objectContaining({ id: "c" })));
  });

  it("map-restore: 詳細から戻ったときは前に選んでいたカードから始まる", async () => {
    const onActiveChange = vi.fn();
    render(
      <NearbyVoices
        center={{ lat: 35.68, lng: 139.76 }}
        fetchPosts={async () => [post("a"), post("b"), post("c")]}
        onActiveChange={onActiveChange}
        initialActiveSpotId="s-c"
      />
    );
    await waitFor(() => expect(onActiveChange).toHaveBeenCalledWith(expect.objectContaining({ id: "c" })));
    expect(document.querySelector("[data-nearby-card='c']")).toHaveAttribute("aria-current", "true");
  });

  it("map-restore: 覚えていたカードが無くなっていたら先頭から始まる", async () => {
    const onActiveChange = vi.fn();
    render(
      <NearbyVoices center={{ lat: 35.68, lng: 139.76 }} fetchPosts={async () => [post("a"), post("b")]} onActiveChange={onActiveChange} initialActiveSpotId="s-zzz" />
    );
    await waitFor(() => expect(onActiveChange).toHaveBeenCalledWith(expect.objectContaining({ id: "a" })));
  });

  it("Task3: 選ばれていないカードのタップは選ぶだけ（画面は移らない）、選ばれているカードのタップで投稿一覧へ", async () => {
    push.mockClear();
    const onActiveChange = vi.fn();
    render(<NearbyVoices center={{ lat: 35.68, lng: 139.76 }} backHref="/map?mode=explore" fetchPosts={async () => [post("a"), post("b")]} onActiveChange={onActiveChange} />);
    await waitFor(() => expect(document.querySelectorAll("[data-nearby-card]")).toHaveLength(2));
    // 2 枚目（選ばれていない）を押す → 選ばれるだけ
    fireEvent.click(document.querySelector("[data-nearby-card='b']") as HTMLElement);
    expect(push).not.toHaveBeenCalled();
    expect(onActiveChange).toHaveBeenLastCalledWith(expect.objectContaining({ id: "b" }));
    expect(document.querySelector("[data-nearby-card='b']")).toHaveAttribute("aria-current", "true");
    // もう一度押す → そのスポットの投稿一覧へ
    fireEvent.click(document.querySelector("[data-nearby-card='b']") as HTMLElement);
    expect(push).toHaveBeenCalledWith("/spots/s-b?back=%2Fmap%3Fmode%3Dexplore");
  });

  it("Task3: カードはリンクではなくボタン（キーボードでも押せる）", async () => {
    render(<NearbyVoices center={{ lat: 35.68, lng: 139.76 }} fetchPosts={async () => [post("a")]} />);
    await waitFor(() => expect(document.querySelector("[data-nearby-card]")).toBeInTheDocument());
    expect((document.querySelector("[data-nearby-card='a']") as HTMLElement).tagName).toBe("BUTTON");
  });
});

/*
 * explore-mode Task 4（2026-10-02）: 絞り込み
 * 出典: docs/tasks/map-search/explore-mode/04-filter.md 4-5
 *       要件定義書 3.4.6・8 章 100
 */
describe("NearbyVoices の絞り込み（explore-mode Task 4）", () => {
  const openSheet = async () => {
    fireEvent.click(screen.getByRole("button", { name: "絞り込み" }));
    await waitFor(() => expect(screen.getByRole("dialog", { name: "絞り込み" })).toBeInTheDocument());
  };

  it("移動手段の横に「移動手段」の文字は出さない（読み上げの名前だけ残す）", async () => {
    render(<NearbyVoices center={{ lat: 35.68, lng: 139.76 }} fetchPosts={async () => [post("a")]} />);
    await waitFor(() => expect(screen.getByRole("combobox", { name: "移動手段" })).toBeInTheDocument());
    // 見出しの行の文字は「近くのスポット」＋プルダウンの選択肢だけ（「移動手段」というラベルは無い）
    const header = screen.getByRole("heading", { name: "近くのスポット" }).parentElement as HTMLElement;
    expect(header.textContent).not.toContain("移動手段");
  });

  it("条件が無いときは数が付かない。入れると効いている数が出る", async () => {
    const { rerender } = render(<NearbyVoices center={{ lat: 35.68, lng: 139.76 }} fetchPosts={async () => [post("a")]} />);
    const button = await screen.findByRole("button", { name: "絞り込み" });
    expect(button.textContent).toBe("");
    expect(button.className).toContain("border-line");

    rerender(
      <NearbyVoices
        center={{ lat: 35.68, lng: 139.76 }}
        fetchPosts={async () => [post("a")]}
        filters={{ ...EMPTY_SPOT_FILTERS, categories: ["グルメ", "観光スポット"], minRating: 4 }}
      />
    );
    // カテゴリは何個選んでも 1 つと数えるので 2 つ（カテゴリ＋評価）
    expect(screen.getByRole("button", { name: "絞り込み" }).textContent).toBe("2");
    expect(screen.getByRole("button", { name: "絞り込み" }).className).toContain("bg-accent");
  });

  it("シートには 距離 と 期間 を出さず、評価（平均）とチェックボックスを出す", async () => {
    render(<NearbyVoices center={{ lat: 35.68, lng: 139.76 }} fetchPosts={async () => [post("a")]} />);
    await screen.findByRole("button", { name: "絞り込み" });
    await openSheet();
    const sheet = screen.getByRole("dialog", { name: "絞り込み" });
    expect(sheet.textContent).toContain("予算（平均）");
    expect(sheet.textContent).toContain("評価（平均）");
    expect(sheet.textContent).toContain("タビコエだけの場所");
    expect(sheet.textContent).not.toContain("期間（訪問日）");
    expect(sheet.textContent).not.toContain("距離");
    // 星は ★1 以上〜★5 の 5 つ
    expect(screen.getByLabelText("★4 以上")).toBeInTheDocument();
    expect(screen.getByLabelText("★5")).toBeInTheDocument();
  });

  it("「この条件で表示」で、選んだ条件が親に渡る", async () => {
    const onFiltersChange = vi.fn();
    render(<NearbyVoices center={{ lat: 35.68, lng: 139.76 }} fetchPosts={async () => [post("a")]} onFiltersChange={onFiltersChange} />);
    await screen.findByRole("button", { name: "絞り込み" });
    await openSheet();
    fireEvent.click(screen.getByLabelText("★4 以上"));
    fireEvent.click(screen.getByLabelText("グルメ"));
    fireEvent.click(screen.getByText("タビコエだけの場所").closest("label") as HTMLElement);
    fireEvent.click(screen.getByRole("button", { name: "この条件で表示" }));
    expect(onFiltersChange).toHaveBeenCalledWith({
      categories: ["グルメ"],
      cost: null,
      duration: null,
      minRating: 4,
      manualOnly: true,
    });
  });

  it("条件を変えると、その条件で取り直す", async () => {
    const fetchPosts = vi.fn(async () => [post("a")]);
    const filters = { ...EMPTY_SPOT_FILTERS, cost: "1000" as const };
    const { rerender } = render(<NearbyVoices center={{ lat: 35.68, lng: 139.76 }} fetchPosts={fetchPosts} />);
    await waitFor(() => expect(fetchPosts).toHaveBeenCalledWith({ lat: 35.68, lng: 139.76 }, "walk", EMPTY_SPOT_FILTERS));
    rerender(<NearbyVoices center={{ lat: 35.68, lng: 139.76 }} fetchPosts={fetchPosts} filters={filters} />);
    await waitFor(() => expect(fetchPosts).toHaveBeenLastCalledWith({ lat: 35.68, lng: 139.76 }, "walk", filters));
  });

  it("0 件の文言: 絞り込み中は「条件に合う場所がありません」", async () => {
    render(<NearbyVoices center={{ lat: 35.68, lng: 139.76 }} fetchPosts={async () => []} filters={{ ...EMPTY_SPOT_FILTERS, minRating: 5 }} />);
    expect(await screen.findByText("条件に合う場所がありません")).toBeInTheDocument();
  });

  it("0 件の文言: 絞り込んでいなければ今までどおり範囲の案内", async () => {
    render(<NearbyVoices center={{ lat: 35.68, lng: 139.76 }} fetchPosts={async () => []} />);
    expect(await screen.findByText(/この範囲に投稿はありません/)).toBeInTheDocument();
  });
});
