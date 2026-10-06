import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/components/map/MapScreen", () => ({ MapScreen: ({ open }: { open: { savedOnly?: boolean } }) => <div data-testid="map-stub" data-saved-only={open.savedOnly ? "true" : "false"} /> }));

import { WishlistScreen } from "./WishlistScreen";
import { SPOT_PLACEHOLDER_IMAGE_URL, type WishlistItem } from "@/lib/wishlist/constants";

/**
 * 出典: docs/tasks/records/wishlist/02-wishlist-list-screen.md（SC-08）
 * - 投稿がないスポットにはプレースホルダ画像が表示されること
 * - 一覧から保存を取り消すと一覧から消えること（Task4 シナリオ3 の単体相当）
 */
const items: WishlistItem[] = [
  {
    spotId: "a",
    name: "浅草寺",
    prefecture: "東京都",
    lat: 35,
    lng: 139,
    savedAt: "2026-09-12T00:00:00Z",
    thumbnailUrl: "https://example.com/a.jpg",
    hasPost: true,
    postCount: 3,
    itineraries: [{ id: "it-1", title: "大阪旅行", dayIndex: 1 }],
  },
  {
    spotId: "b",
    name: "投稿のない場所",
    prefecture: null,
    lat: 34,
    lng: 135,
    savedAt: "2026-09-11T00:00:00Z",
    thumbnailUrl: SPOT_PLACEHOLDER_IMAGE_URL,
    hasPost: false,
    postCount: 0,
    itineraries: [],
  },
];

describe("WishlistScreen", () => {
  it("保存が無ければ空メッセージ", () => {
    render(<WishlistScreen initialItems={[]} submitRemove={vi.fn()} />);
    expect(screen.getByText("まだ「行きたい」スポットはありません")).toBeInTheDocument();
  });

  it("投稿があるスポットは写真、投稿がないスポットはプレースホルダを表示する", () => {
    render(<WishlistScreen initialItems={items} submitRemove={vi.fn()} />);

    expect(screen.getByAltText("浅草寺の写真")).toHaveAttribute("src", "https://example.com/a.jpg");
    const placeholder = screen.getByAltText("投稿がないスポット");
    expect(placeholder).toHaveAttribute("src", SPOT_PLACEHOLDER_IMAGE_URL);
    expect(placeholder).toHaveAttribute("data-placeholder", "true");
  });

  it("Bug #471: 戻るは back があればその画面名、無ければマイページ。スポットへのリンクには行きたいを back で渡す", () => {
    const { unmount } = render(<WishlistScreen initialItems={items} submitRemove={vi.fn()} back={{ href: "/itineraries", label: "しおり一覧" }} />);
    expect(screen.getByRole("link", { name: "しおり一覧" })).toHaveAttribute("href", "/itineraries");
    expect(document.querySelector("[data-wishlist-item='a'] a")).toHaveAttribute("href", "/spots/a?back=%2Fwishlist%3Fback%3D%252Fitineraries");
    unmount();
    render(<WishlistScreen initialItems={items} submitRemove={vi.fn()} />);
    expect(screen.getByRole("link", { name: "マイページ" })).toHaveAttribute("href", "/mypage");
    expect(document.querySelector("[data-wishlist-item='a'] a")).toHaveAttribute("href", "/spots/a?back=%2Fwishlist");
  });

  it("v3.1: 解除はゴミ箱マークのボタン（文字の「解除」は出ない）", () => {
    render(<WishlistScreen initialItems={items} submitRemove={vi.fn()} />);
    const button = screen.getByRole("button", { name: "浅草寺の保存を解除" });
    expect(button.querySelector("svg")).not.toBeNull();
    expect(button.textContent).not.toContain("解除");
  });

  it("解除すると取消APIを呼び、その行だけ消える", async () => {
    const submitRemove = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    render(<WishlistScreen initialItems={items} submitRemove={submitRemove} />);

    fireEvent.click(screen.getByRole("button", { name: "浅草寺の保存を解除" }));

    await waitFor(() => expect(screen.queryByText("浅草寺")).not.toBeInTheDocument());
    expect(submitRemove).toHaveBeenCalledWith("a");
    expect(screen.getByText("投稿のない場所")).toBeInTheDocument();
  });

  it("解除に失敗したらエラーを表示し、行は残る", async () => {
    const submitRemove = vi.fn().mockResolvedValue(new Response(null, { status: 500 }));
    render(<WishlistScreen initialItems={items} submitRemove={submitRemove} />);

    fireEvent.click(screen.getByRole("button", { name: "浅草寺の保存を解除" }));

    await waitFor(() => expect(screen.getByText("保存を解除できませんでした")).toBeInTheDocument());
    expect(screen.getByText("浅草寺")).toBeInTheDocument();
  });

  it("v3.0: 一覧／地図の切替で URL と表示が変わり、地図は保存済みのピンだけ", () => {
    render(<WishlistScreen initialItems={items} submitRemove={vi.fn()} />);
    expect(screen.getByText(/投稿 3 件/)).toBeInTheDocument();
    expect(screen.getByText(/大阪旅行 Day 1/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "地図" }));
    expect(replace).toHaveBeenCalledWith("/wishlist?view=map", { scroll: false });
    expect(screen.getByTestId("map-stub")).toHaveAttribute("data-saved-only", "true");
    fireEvent.click(screen.getByRole("radio", { name: "一覧" }));
    expect(replace).toHaveBeenLastCalledWith("/wishlist", { scroll: false });
    expect(screen.queryByTestId("map-stub")).toBeNull();
  });

  it("v3.0: 「＋」でしおり選択シートが開き、追加後も行が残る", async () => {
    const api = {
      itineraries: {
        list: vi.fn(async () => ({ items: [{ id: "it-1", tripId: "t1", title: "大阪旅行", startDate: null, endDate: null, dayCount: 0, spotCount: 1, checkedCount: 0, updatedAt: "", role: "owner" as const, hasAlbumPosts: false, containsSpot: false, spotDayIndex: null }] })),
        addSpot: vi.fn(async () => Response.json({}, { status: 201 })),
      },
      wishlistCount: vi.fn(async () => 2),
      toggleWishlist: vi.fn(),
    } as unknown as import("@/components/save/SaveSheet").SaveSheetApi;
    render(<WishlistScreen initialItems={items} submitRemove={vi.fn()} saveSheetApi={api} />);
    // #745: しおりに入っている行は読み上げ名が変わる（見た目は ✓）
    fireEvent.click(screen.getByRole("button", { name: /浅草寺はしおりに入っています/ }));
    expect(await screen.findByRole("dialog", { name: "浅草寺 をしおりへ" })).toBeInTheDocument();
    // 「行きたい」の段は出さない
    expect(screen.queryByRole("checkbox", { name: /行きたいスポット/ })).toBeNull();
    fireEvent.click(await screen.findByRole("checkbox", { name: /大阪旅行/ }));
    await waitFor(() => expect(api.itineraries.addSpot).toHaveBeenCalledWith("it-1", "a", null));
    fireEvent.click(screen.getByRole("button", { name: "完了" }));
    expect(document.querySelector("[data-wishlist-item='a']")).toBeInTheDocument();
    expect(await screen.findByRole("status")).toHaveTextContent("大阪旅行 に保存しました");
  });
});

/**
 * #745（2026-10-06）: しおりに入れても「＋」のままだった。
 *
 * 【初心者向け】決定事項 76 は「行きたい・しおりのどれかに入っていれば ✓」だが、
 * **この画面は全部が「行きたい」に入っている**ので、それをそのまま当てると全部 ✓ になって
 * 意味がない。ここで知りたいのは「**しおりに入れたか**」。
 */
describe("しおりに入っていれば ✓（#745）", () => {
  it("入っている行は ✓、入っていない行は ＋", () => {
    render(<WishlistScreen initialItems={items} submitRemove={vi.fn()} />);
    const inItinerary = document.querySelector("[data-wishlist-item='a'] [data-itinerary-saved]");
    expect(inItinerary, "しおりに入っている行が ✓ になっていない").not.toBeNull();
    expect(document.querySelector("[data-wishlist-item='b'] [data-itinerary-saved]")).toBeNull();
  });

  it("保存すると、その場で ✓ に変わる（取り直しを待たない）", async () => {
    const api = {
      itineraries: {
        list: vi.fn(async () => ({ items: [{ id: "it-9", tripId: "t9", title: "京都旅行", startDate: null, endDate: null, dayCount: 0, spotCount: 0, checkedCount: 0, updatedAt: "", role: "owner" as const, hasAlbumPosts: false, containsSpot: false, spotDayIndex: null }] })),
        addSpot: vi.fn(async () => Response.json({}, { status: 201 })),
      },
      wishlistCount: vi.fn(async () => 2),
      toggleWishlist: vi.fn(),
    } as unknown as import("@/components/save/SaveSheet").SaveSheetApi;

    render(<WishlistScreen initialItems={items} submitRemove={vi.fn()} saveSheetApi={api} />);
    // まだどのしおりにも入っていない行
    expect(document.querySelector("[data-wishlist-item='b'] [data-itinerary-saved]")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /をしおりへ$/ }));
    fireEvent.click(await screen.findByRole("checkbox", { name: /京都旅行/ }));
    await waitFor(() => expect(api.itineraries.addSpot).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "完了" }));
    await waitFor(() => expect(document.querySelector("[data-wishlist-item='b'] [data-itinerary-saved]")).not.toBeNull());
  });
});

/** #746（2026-10-06）: 見出しが中央からずれていた（左右の幅が違うのに真ん中を伸ばしていた） */
describe("見出しの位置（#746）", () => {
  it("左右を同じ幅にして真ん中を挟む", () => {
    render(<WishlistScreen initialItems={items} submitRemove={vi.fn()} />);
    const row = screen.getByRole("heading", { name: "行きたい" }).parentElement!;
    expect(row.className).toContain("grid-cols-[1fr_auto_1fr]");
  });
});
