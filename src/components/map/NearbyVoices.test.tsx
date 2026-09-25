import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { centeredCardIndex, NearbyVoices } from "./NearbyVoices";
import type { NearbyPost } from "@/lib/posts/nearby-posts";

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
