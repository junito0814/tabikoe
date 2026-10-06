/**
 * 出典: docs/tasks/map-search/search-top/02-search-top-screen.md（単体テスト）
 *       docs/tasks/map-search/search-top/03-submit-and-geocode.md / 04-geolocation-hook.md
 * 「3 要素だけが描画され、地図・一覧が無いこと」「入力で候補が表示されラベルが付くこと」
 * 「座標化失敗時にエラーメッセージが出て遷移しないこと」「拒否時にそれぞれの挙動になること」
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock("@/app/fonts", () => ({ outfit: { className: "" }, lora: { className: "" } }));

import { SearchTopScreen, type SearchTopApi } from "./SearchTopScreen";
import type { DestinationSuggestion } from "@/lib/search/suggest-destinations";

const SUGGESTIONS: DestinationSuggestion[] = [
  { kind: "prefecture", name: "大阪府", lat: 34.6, lng: 135.5 },
  { kind: "station", name: "大阪駅", secondaryText: "大阪府大阪市北区", placeId: "p1" },
  { kind: "spot", name: "大阪城", spotId: "s1", prefecture: "大阪府" },
];
const api: SearchTopApi = {
  suggest: vi.fn(async () => ({ suggestions: SUGGESTIONS, placesUnavailable: false })),
  geocode: vi.fn(async () => null),
};
const denied = { getCurrentPosition: (_ok: PositionCallback, err?: PositionErrorCallback) => err?.({ code: 1 } as GeolocationPositionError) };
const granted = { getCurrentPosition: (ok: PositionCallback) => ok({ coords: { latitude: 35.1, longitude: 139.2 } } as GeolocationPosition) };

beforeEach(() => {
  push.mockReset();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

describe("SearchTopScreen", () => {
  it("入力欄と 2 つのボタンだけがあり、地図や一覧は無い", () => {
    const { container } = render(<SearchTopScreen api={api} geolocation={granted} />);
    expect(screen.getByRole("combobox", { name: "行き先" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "近くのスポットを探す" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ここに投稿" })).toBeInTheDocument(); // #807: 右下の PostFab
    expect(container.querySelector("[role=region]")).toBeNull();
  });

  it("入力すると候補が種別ラベル付きで出て、選ぶと投稿一覧へ", async () => {
    render(<SearchTopScreen api={api} geolocation={granted} />);
    fireEvent.change(screen.getByRole("combobox", { name: "行き先" }), { target: { value: "おおさ" } });
    await act(async () => {
      vi.advanceTimersByTime(350);
    });
    await screen.findByRole("option", { name: /^大阪府/ });
    expect(screen.getByText("都道府県")).toBeInTheDocument();
    expect(screen.getByText("駅")).toBeInTheDocument();
    expect(screen.getByText("スポット")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: /大阪城/ }).querySelector("button")!);
    // #756: ホームから来たことを伝える（開いた先の戻るが「‹ ホーム」になる）
    expect(push).toHaveBeenCalledWith("/search?spot=s1&back=%2F");
  });

  /**
   * #699（2026-10-05）: Google の規約が「Places のデータを地図の無い画面に出すときは
   * 「Google マップ」の表記を出す」「どれが Google 由来か分かるようにする」と求めている。
   */
  it("候補を出どころで分け、Google の組の下に公式のロゴを出す", async () => {
    render(<SearchTopScreen api={api} geolocation={granted} />);
    fireEvent.change(screen.getByRole("combobox", { name: "行き先" }), { target: { value: "おおさ" } });
    await act(async () => {
      vi.advanceTimersByTime(350);
    });
    await screen.findByRole("option", { name: /^大阪府/ });

    const groups = screen.getAllByRole("listbox");
    expect(groups.map((group) => group.getAttribute("aria-label"))).toEqual([
      "タビコエの中から",
      "Google マップから",
    ]);
    expect(document.querySelector("[data-google-maps-attribution]")).toBeInTheDocument();
  });

  it("候補に無い文字列で決定して座標化できなければエラーを出し、遷移しない", async () => {
    const failing: SearchTopApi = { suggest: async () => ({ suggestions: [], placesUnavailable: false }), geocode: async () => null };
    render(<SearchTopScreen api={failing} geolocation={granted} />);
    const input = screen.getByRole("combobox", { name: "行き先" });
    fireEvent.change(input, { target: { value: "xxxxx" } });
    fireEvent.submit(input.closest("form")!);
    await waitFor(() => expect(screen.getByText(/見つかりませんでした/)).toBeInTheDocument());
    expect(push).not.toHaveBeenCalled();
  });

  it("「近くのスポットを探す」は許可なら探すモードへ、拒否なら案内を出して入力欄にフォーカス", async () => {
    const { unmount } = render(<SearchTopScreen api={api} geolocation={granted} />);
    fireEvent.click(screen.getByRole("button", { name: "近くのスポットを探す" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/map?mode=explore&lat=35.1&lng=139.2"));
    unmount();
    push.mockReset();
    render(<SearchTopScreen api={api} geolocation={denied} />);
    fireEvent.click(screen.getByRole("button", { name: "近くのスポットを探す" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("行き先を入力してください"));
    expect(push).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole("combobox", { name: "行き先" })).toHaveFocus());
  });

  it("右下の「ここに投稿」（#807）は許可なら現在地付き、拒否なら位置なしで投稿画面へ", async () => {
    const { unmount } = render(<SearchTopScreen api={api} geolocation={granted} />);
    fireEvent.click(screen.getByRole("button", { name: "ここに投稿" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/posts/new?lat=35.1&lng=139.2&from=current"));
    unmount();
    push.mockReset();
    render(<SearchTopScreen api={api} geolocation={denied} />);
    fireEvent.click(screen.getByRole("button", { name: "ここに投稿" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/posts/new?from=current"));
  });

  it("Task3（2026-09-25）: ホームを開くと覚えている地図の状態を消す（次に探すモードを開くと初期値）", () => {
    const storage = window.sessionStorage;
    storage.setItem("tabikoe:map-state", JSON.stringify({ entry: "explore", mode: "explore", center: { lat: 1, lng: 2 }, zoom: 15, savedAt: Date.now() }));
    render(<SearchTopScreen />);
    expect(storage.getItem("tabikoe:map-state")).toBeNull();
  });
});

/**
 * #740（2026-10-06）: 候補の下がメニューバーに隠れ、**Google のロゴまで見えなくなっていた**。
 * 規約が求める表記なので、見えないのは出していないのと同じ。
 */
describe("候補がメニューバーに隠れない（#740）", () => {
  async function openSuggestions() {
    render(<SearchTopScreen api={api} geolocation={granted} />);
    fireEvent.change(screen.getByRole("combobox", { name: "行き先" }), { target: { value: "おおさ" } });
    await act(async () => {
      vi.advanceTimersByTime(350);
    });
    await screen.findByRole("option", { name: /^大阪府/ });
    return document.querySelector("[data-google-maps-attribution]")!.closest("div.absolute") ?? screen.getAllByRole("listbox")[0]!.closest("div.absolute")!;
  }

  it("メニューバー（z-40）より上に出る", async () => {
    const panel = await openSuggestions();
    expect(panel.className).toContain("z-50");
  });

  it("高さに上限があり、はみ出さない", async () => {
    const panel = await openSuggestions();
    expect(panel.className).toContain("max-h-[min(420px,50dvh)]");
  });

  /** ロゴがスクロールの中にあると、スクロールしないと見えない＝規約の求めを満たさない */
  it("Google のロゴはスクロールの外にある（常に見える）", async () => {
    await openSuggestions();
    const logo = document.querySelector("[data-google-maps-attribution]")!;
    const scroller = document.querySelector(".overflow-y-auto");
    expect(scroller).not.toBeNull();
    expect(scroller!.contains(logo)).toBe(false);
  });
});

/**
 * #749（2026-10-06）: キーボードが出ると Google の表記が隠れていた。
 *
 * 【初心者向け】`window.innerHeight`（画面全体）はキーボードが出ても変わらない。
 * 変わるのは `window.visualViewport`（いま実際に見えている範囲）。
 * jsdom には大きさが無いので、ここでは「**見える範囲を聞いているか**」を見る。
 */
describe("キーボードが出ても表記が見える（#749）", () => {
  const source = readFileSync("src/components/search/DestinationInput.tsx", "utf8");

  it("画面全体ではなく、見えている範囲で測る", () => {
    expect(source).toContain("window.visualViewport");
    expect(source).toContain("viewport.offsetTop + viewport.height");
  });

  it("キーボードの開閉で測り直す", () => {
    expect(source).toContain('viewport.addEventListener("resize", measure)');
    expect(source).toContain('viewport.addEventListener("scroll", measure)');
    expect(source).toContain('viewport.removeEventListener("resize", measure)');
  });

  /**
   * 最初は「狭すぎたら CSS の上限に任せる」としていたが、それだと**狭いときほど背が高くなり**、
   * キーボードが出たときに隠れたままだった。測れたらその値を必ず使う。
   */
  it("測れた余白は必ず使う（狭いときに上限へ戻さない）", () => {
    expect(source).toContain("setMaxHeight(space > 0 ? space : null)");
    expect(source).not.toContain("MIN_PANEL_PX");
  });

  it("キーボードが出ているときはメニューバーのぶんを引かない（その下に隠れるため）", () => {
    expect(source).toContain("keyboardOpen");
    expect(source).toContain("!keyboardOpen && window.innerWidth < 768");
  });
});

/**
 * #808（2026-10-06）: ホームの 3 つ目は「みんなの投稿を見る」
 * 出典: 要件定義書 3.4.1、ワイヤーフレーム決定事項 83
 */
describe("みんなの投稿を見る（#808）", () => {
  it("3 つ目は /search へのリンク（位置情報も入力も要らない）", () => {
    render(<SearchTopScreen api={api} geolocation={granted} />);
    expect(screen.getByRole("link", { name: "みんなの投稿を見る" })).toHaveAttribute("href", "/search");
  });

  it("ホームに置くのは 入力欄・近くのスポットを探す・みんなの投稿を見る の 3 つだけ（投稿は右下の PostFab）", () => {
    const { container } = render(<SearchTopScreen api={api} geolocation={granted} />);
    const labels = [...container.querySelectorAll("button, a")]
      .filter((el) => !el.closest("[data-post-fab]"))
      .map((el) => el.textContent?.trim())
      .filter((t) => t && t.length > 0);
    expect(labels).toEqual(["近くのスポットを探す", "みんなの投稿を見る"]);
  });
});
