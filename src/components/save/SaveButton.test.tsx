import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SaveButton } from "./SaveButton";
import type { SaveSheetApi } from "./SaveSheet";
import type { ItineraryListItem } from "@/lib/itineraries/get-itinerary";

/**
 * 出典: docs/tasks/records/wishlist-v3/01-save-sheet.md 単体テスト
 * - チェックの付け外しで対応 API が呼ばれること
 * - 期間ありのしおりで Day 選択が展開し、既定が日付なしであること
 * - 追加モード中はシートを開かず追加 API を呼ぶこと
 * 出典: docs/tasks/itinerary/add-spots/02-add-mode.md 単体テスト
 * - 追加モード中の「＋」がシートを開かないこと。入っているスポットは ✓ で、押すと外れる
 */
const items: ItineraryListItem[] = [
  { id: "it-1", tripId: "t1", title: "大阪旅行", startDate: "2026-09-20", endDate: "2026-09-22", dayCount: 3, spotCount: 5, checkedCount: 0, updatedAt: "", role: "owner", hasAlbumPosts: false, containsSpot: false, spotDayIndex: null },
  { id: "it-2", tripId: "t2", title: "北海道旅行", startDate: null, endDate: null, dayCount: 0, spotCount: 3, checkedCount: 0, updatedAt: "", role: "member", hasAlbumPosts: false, containsSpot: true, spotDayIndex: null },
];

function makeApi(): SaveSheetApi {
  return {
    itineraries: {
      list: vi.fn(async () => ({ items })),
      create: vi.fn(async () => Response.json({ itineraryId: "it-new" }, { status: 201 })),
      get: vi.fn(),
      updatePeriod: vi.fn(),
      rename: vi.fn(),
      remove: vi.fn(),
      addSpot: vi.fn(async () => Response.json({}, { status: 201 })),
      updateSpot: vi.fn(async () => Response.json({})),
      removeSpot: vi.fn(async () => Response.json({})),
      issueInvitation: vi.fn(),
      listInvitations: vi.fn(),
      revokeInvitation: vi.fn(),
      fetchInviteCandidates: vi.fn(async () => ({ candidates: [] })),
      searchUsers: vi.fn(async () => ({ users: [] })),
      sendInvitation: vi.fn(),
      removeMember: vi.fn(),
      leave: vi.fn(),
    },
    wishlistCount: vi.fn(async () => 12),
    toggleWishlist: vi.fn(async () => Response.json({})),
  };
}

describe("SaveButton / SaveSheet", () => {
  it("押すと保存先シート。行きたい・しおりのチェックで API が呼ばれ、Day 選択は既定が日付なし", async () => {
    const api = makeApi();
    render(<SaveButton spotId="s1" initialSaved={false} api={api} />);
    fireEvent.click(screen.getByRole("button", { name: "行きたい" }));
    expect(await screen.findByRole("dialog", { name: "行きたい・しおりに入れる" })).toBeInTheDocument();
    expect(await screen.findByText("12 件")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: /行きたいスポット/ }));
    await waitFor(() => expect(api.toggleWishlist).toHaveBeenCalledWith("s1", true));

    fireEvent.click(await screen.findByRole("checkbox", { name: /大阪旅行/ }));
    await waitFor(() => expect(api.itineraries.addSpot).toHaveBeenCalledWith("it-1", "s1", null));
    const days = await screen.findByRole("radiogroup", { name: "大阪旅行 の Day" });
    expect(days.querySelectorAll("[role=radio]")).toHaveLength(4);
    expect(screen.getByRole("radio", { name: "日付なし" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("radio", { name: "Day 2" }));
    await waitFor(() => expect(api.itineraries.updateSpot).toHaveBeenCalledWith("it-1", "s1", { dayIndex: 2 }));

    // 入っているしおりのチェックを外すと削除
    fireEvent.click(screen.getByRole("checkbox", { name: /北海道旅行/ }));
    await waitFor(() => expect(api.itineraries.removeSpot).toHaveBeenCalledWith("it-2", "s1"));

    fireEvent.click(screen.getByRole("button", { name: "完了" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(await screen.findByRole("status")).toHaveTextContent("大阪旅行 に保存しました");
    expect(screen.getByRole("link", { name: "しおりを見る" })).toHaveAttribute("href", "/itineraries/it-1");
    expect(screen.getByRole("button", { name: "行きたいに入っています（押すと変えられます）" })).toHaveAttribute("aria-pressed", "true");
  });

  it("「＋ 新しいしおりを作る」はタイトルだけで作り、そのスポットを入れる", async () => {
    const api = makeApi();
    render(<SaveButton spotId="s1" initialSaved={false} api={api} />);
    fireEvent.click(screen.getByRole("button", { name: "行きたい" }));
    fireEvent.click(await screen.findByRole("button", { name: "＋ 新しいしおりを作る" }));
    fireEvent.change(screen.getByRole("textbox", { name: "アルバム名" }), { target: { value: "金沢 日帰り" } });
    fireEvent.click(screen.getByRole("button", { name: "作る" }));
    await waitFor(() => expect(api.itineraries.create).toHaveBeenCalledWith({ title: "金沢 日帰り", startDate: null, endDate: null }));
    await waitFor(() => expect(api.itineraries.addSpot).toHaveBeenCalledWith("it-new", "s1", null));
    expect(await screen.findByRole("checkbox", { name: /金沢 日帰り/ })).toBeChecked();
  });

  it("追加モードではシートを開かず、そのしおりへ直接追加。入っていれば ✓ で押すと外れる", async () => {
    const add = vi.fn(async () => Response.json({}, { status: 201 }));
    const remove = vi.fn(async () => Response.json({}));
    render(<SaveButton spotId="s1" initialSaved={false} addMode={{ itineraryId: "it-1", day: 2, initialAdded: false }} addToItinerary={add} removeFromItinerary={remove} />);
    fireEvent.click(screen.getByRole("button", { name: "しおりに追加" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(add).toHaveBeenCalledWith("it-1", "s1", 2));
    const button = screen.getByRole("button", { name: /追加済み/ });
    expect(button).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(button);
    await waitFor(() => expect(remove).toHaveBeenCalledWith("it-1", "s1"));
    expect(screen.getByRole("button", { name: "しおりに追加" })).toHaveAttribute("aria-pressed", "false");
  });
});

describe("loading-feedback Task 3: 保存シートは押した瞬間にチェックが入る", () => {
  it("行きたいのチェックが、API の結果を待たずに入る", async () => {
    const api = makeApi();
    let resolveToggle: (response: Response) => void = () => {};
    api.toggleWishlist = vi.fn(() => new Promise<Response>((resolve) => { resolveToggle = resolve; }));
    render(<SaveButton spotId="s1" initialSaved={false} api={api} />);
    fireEvent.click(screen.getByRole("button", { name: "行きたい" }));

    const checkbox = await screen.findByRole("checkbox", { name: /行きたいスポット/ });
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox);
    // 通信が終わる前にチェックが入っている（楽観更新）
    expect(checkbox).toBeChecked();

    resolveToggle(Response.json({}));
    await waitFor(() => expect(api.toggleWishlist).toHaveBeenCalledWith("s1", true));
    expect(checkbox).toBeChecked();
  });

  it("失敗したらチェックが元に戻り、理由が出る", async () => {
    const api = makeApi();
    api.toggleWishlist = vi.fn(async () => Response.json({ error: "x" }, { status: 500 }));
    render(<SaveButton spotId="s1" initialSaved={false} api={api} />);
    fireEvent.click(screen.getByRole("button", { name: "行きたい" }));

    const checkbox = await screen.findByRole("checkbox", { name: /行きたいスポット/ });
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();

    await waitFor(() => expect(screen.getByText("保存できませんでした")).toBeInTheDocument());
    expect(checkbox).not.toBeChecked();
  });

  it("しおりのチェックも押した瞬間に入り、失敗したら戻る", async () => {
    const api = makeApi();
    api.itineraries.addSpot = vi.fn(async () => Response.json({ error: "x" }, { status: 500 }));
    render(<SaveButton spotId="s1" initialSaved={false} api={api} />);
    fireEvent.click(screen.getByRole("button", { name: "行きたい" }));

    const checkbox = await screen.findByRole("checkbox", { name: /大阪旅行/ });
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();

    await waitFor(() => expect(screen.getByText("しおりに保存できませんでした")).toBeInTheDocument());
    expect(checkbox).not.toBeChecked();
  });
});

/**
 * #758（2026-10-06）: 外しても「＋」に戻らなかった
 * 出典: Issue #758「Bug 5: 行きたい・しおりから外しても「＋」に戻らず「✓」のまま」
 *
 * 【初心者向け】`items` は「しおり it-2 に入っている」状態（`containsSpot: true`）。
 * シートを閉じたときの「✓ か ＋ か」が、**今の本当の状態**に合うかを見る。
 */
describe("外したら ＋ に戻る（#758）", () => {
  const openSheet = () => fireEvent.click(screen.getByRole("button", { name: /行きたい/ }));
  const closeSheet = () => fireEvent.click(document.querySelector("[data-close-button]") as HTMLElement);

  it("行きたいを外し、どのしおりにも入っていなければ ＋ に戻る", async () => {
    const api = makeApi();
    api.itineraries.list = vi.fn(async () => ({ items: items.map((item) => ({ ...item, containsSpot: false })) }));
    render(<SaveButton spotId="s1" initialSaved api={api} />);
    openSheet();
    await waitFor(() => expect(screen.getByRole("checkbox", { name: /行きたい/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("checkbox", { name: /行きたい/ })); // 外す
    await waitFor(() => expect(api.toggleWishlist).toHaveBeenCalledWith("s1", false));
    closeSheet();
    expect(screen.getByRole("button", { name: "行きたい" })).toBeInTheDocument();
  });

  it("行きたいを外しても、どれかのしおりに入っていれば ✓ のまま", async () => {
    const api = makeApi(); // it-2 は containsSpot: true
    render(<SaveButton spotId="s1" initialSaved api={api} />);
    openSheet();
    await waitFor(() => expect(screen.getByRole("checkbox", { name: /行きたい/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("checkbox", { name: /行きたい/ }));
    await waitFor(() => expect(api.toggleWishlist).toHaveBeenCalledWith("s1", false));
    closeSheet();
    expect(screen.getByRole("button", { name: "行きたいに入っています（押すと変えられます）" })).toBeInTheDocument();
  });

  it("しおりから外し、行きたいにも入っていなければ ＋ に戻る", async () => {
    const api = makeApi();
    render(<SaveButton spotId="s1" initialSaved={false} api={api} />);
    openSheet();
    await waitFor(() => expect(screen.getByRole("checkbox", { name: /北海道旅行/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("checkbox", { name: /北海道旅行/ })); // 入っていたので外れる
    await waitFor(() => expect(api.itineraries.removeSpot).toHaveBeenCalled());
    closeSheet();
    expect(screen.getByRole("button", { name: "行きたい" })).toBeInTheDocument();
  });
});
