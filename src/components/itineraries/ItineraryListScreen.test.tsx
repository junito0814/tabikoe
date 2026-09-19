import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

import { ItineraryListScreen } from "./ItineraryListScreen";
import type { ItineraryApi } from "./itinerary-api";
import type { ItineraryListItem } from "@/lib/itineraries/get-itinerary";

/**
 * 出典: docs/tasks/itinerary/itinerary-basics/02-itinerary-list-screen.md 単体テスト
 * - 並び順（期間が近い順→未設定→過ぎたもの）
 * - 期間を過ぎた行に「アルバムを見る」が出ること
 * 出典: docs/tasks/itinerary/itinerary-basics/03-itinerary-detail-skeleton.md
 * - 「＋ 新規」で旅行タイトルと期間を指定して作れること（受入条件57）
 */
const item = (id: string, overrides: Partial<ItineraryListItem> = {}): ItineraryListItem => ({
  id,
  tripId: `trip-${id}`,
  title: `旅行${id}`,
  startDate: null,
  endDate: null,
  dayCount: 0,
  spotCount: 3,
  checkedCount: 1,
  updatedAt: "2026-09-01T00:00:00Z",
  role: "owner",
  hasAlbumPosts: false,
  ...overrides,
});

const api = { create: vi.fn(async () => new Response(JSON.stringify({ itineraryId: "it-new" }), { status: 201 })) } as unknown as ItineraryApi;

describe("ItineraryListScreen（SC-22）", () => {
  it("期間が近い順 → 未設定 → 過ぎたもの（薄くせず「済」の印、アルバムを見る）。先頭に行きたいの入口（v3.1）", () => {
    render(
      <ItineraryListScreen
        today="2026-09-18"
        items={[
          item("past", { startDate: "2026-08-10", endDate: "2026-08-10", hasAlbumPosts: true }),
          item("undated"),
          item("soon", { startDate: "2026-09-20", endDate: "2026-09-22", dayCount: 3 }),
        ]}
        wishlistCount={6}
        api={api}
      />
    );
    const titles = screen.getAllByRole("link", { name: /旅行/ }).map((link) => link.textContent);
    expect(titles[0]).toContain("旅行soon");
    expect(titles[1]).toContain("旅行undated");
    expect(titles[2]).toContain("旅行past");
    const past = document.querySelector("[data-itinerary-group='past']") as HTMLElement;
    expect(past).not.toHaveClass("opacity-60");
    expect(past.querySelector("[data-past-mark]")).toHaveTextContent("済");
    expect(document.querySelector("[data-itinerary-group='upcoming']")?.querySelector("[data-past-mark]")).toBeNull();
    // 期間は年つき
    expect(past).toHaveTextContent("2026/8/10（月） 〜 2026/8/10（月）");
    // 先頭の行きたいの入口
    const entry = screen.getByRole("link", { name: /行きたいスポット/ });
    expect(entry).toHaveAttribute("href", "/wishlist");
    expect(entry).toHaveTextContent("6");
    expect(screen.getByRole("link", { name: /アルバムを見る/ })).toHaveAttribute("href", "/albums/trip-past");
    expect(screen.getByText(/3 日間/)).toBeInTheDocument();
  });

  it("0 件なら案内文", () => {
    render(<ItineraryListScreen today="2026-09-18" items={[]} api={api} />);
    expect(screen.getByText(/しおりがありません/)).toBeInTheDocument();
  });

  it("「＋ 新規」でタイトルと期間を入れて作成すると詳細へ", async () => {
    render(<ItineraryListScreen today="2026-09-18" items={[]} api={api} />);
    fireEvent.click(screen.getByRole("button", { name: "＋ 新規" }));
    fireEvent.change(screen.getByLabelText("アルバム"), { target: { value: "大阪旅行" } });
    fireEvent.change(screen.getByLabelText("開始日（任意）"), { target: { value: "2026-09-20" } });
    fireEvent.change(screen.getByLabelText("終了日（任意）"), { target: { value: "2026-09-22" } });
    fireEvent.click(screen.getByRole("button", { name: "作成する" }));
    await waitFor(() => expect(api.create).toHaveBeenCalledWith({ title: "大阪旅行", startDate: "2026-09-20", endDate: "2026-09-22" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/itineraries/it-new"));
  });
});
