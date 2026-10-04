import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { PullToRefresh } from "./PullToRefresh";
import { PULL_THRESHOLD_PX, PULL_RESISTANCE } from "./pull-to-refresh-state";

/**
 * 出典: docs/tasks/shared-ui/loading-feedback/09-pull-to-refresh.md 単体テスト
 * 要件定義書 4.5.11 の場面 6・8 章 96
 *
 * 【初心者向け】判断そのものは pull-to-refresh-state.test.ts で確かめている。
 * ここでは**部品がその判断どおりに動くか**を見る。いちばん怖いのは誤爆
 * （普通にスクロールしただけで勝手に読み込み直す）なので、そこを重点的に。
 */
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }) }));

/**
 * 指の動きを作る。jsdom は TouchEvent を持たないので、必要な形だけ渡す。
 *
 * 【初心者向け】`act()` で包むのは、この部品が **React の仕組みの外**で
 * 聞き役を登録しているため（跳ね返りを止めるのに「受け身でない」登録が要る）。
 * React の外から state を変えると、包まないと描き直しが追いつかない。
 */
function touch(node: Element, type: "touchstart" | "touchmove" | "touchend", clientY?: number) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "touches", {
    value: clientY === undefined ? [] : [{ clientY }],
  });
  act(() => {
    node.dispatchEvent(event);
  });
}

/** いちばん上にいる／途中までスクロールしている、を作り分ける */
function setScrollTop(value: number) {
  Object.defineProperty(document, "scrollingElement", {
    value: { scrollTop: value },
    configurable: true,
  });
}

function container() {
  return document.querySelector("[data-pull-to-refresh]") as HTMLElement;
}

beforeEach(() => {
  refresh.mockReset();
  setScrollTop(0);
});

/** しきい値に届く指の動き（下ろす距離は指の動きの半分なので倍の距離が要る） */
const ENOUGH = PULL_THRESHOLD_PX * PULL_RESISTANCE;

describe("しきい値を超えて離したときだけ取り直す", () => {
  it("超えて離したら取り直す", async () => {
    render(
      <PullToRefresh>
        <p>一覧</p>
      </PullToRefresh>
    );
    const node = container();
    touch(node, "touchstart", 100);
    touch(node, "touchmove", 100 + ENOUGH);
    touch(node, "touchend");
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  });

  it("届かずに離したら取り直さない", async () => {
    render(
      <PullToRefresh>
        <p>一覧</p>
      </PullToRefresh>
    );
    const node = container();
    touch(node, "touchstart", 100);
    touch(node, "touchmove", 100 + ENOUGH - 2);
    touch(node, "touchend");
    await waitFor(() => expect(refresh).not.toHaveBeenCalled());
  });
});

describe("誤爆させない", () => {
  it("いちばん上にいないときは反応しない", async () => {
    setScrollTop(400);
    render(
      <PullToRefresh>
        <p>一覧</p>
      </PullToRefresh>
    );
    const node = container();
    touch(node, "touchstart", 100);
    touch(node, "touchmove", 100 + ENOUGH);
    touch(node, "touchend");
    await waitFor(() => expect(refresh).not.toHaveBeenCalled());
  });

  it("上に動かしただけでは反応しない", async () => {
    render(
      <PullToRefresh>
        <p>一覧</p>
      </PullToRefresh>
    );
    const node = container();
    touch(node, "touchstart", 300);
    touch(node, "touchmove", 100);
    touch(node, "touchend");
    await waitFor(() => expect(refresh).not.toHaveBeenCalled());
  });

  it("指を置かずに動かしても反応しない", async () => {
    render(
      <PullToRefresh>
        <p>一覧</p>
      </PullToRefresh>
    );
    const node = container();
    touch(node, "touchmove", 500);
    touch(node, "touchend");
    await waitFor(() => expect(refresh).not.toHaveBeenCalled());
  });
});

describe("歯車の出方", () => {
  it("引いていないときは歯車の場所を取らない（ちらつかせない）", () => {
    render(
      <PullToRefresh>
        <p>一覧</p>
      </PullToRefresh>
    );
    const gear = document.querySelector("[data-pull-gear]")!.parentElement!;
    expect(gear.style.height).toBe("0px");
  });

  it("引いた距離に応じて回り、濃くなる", () => {
    render(
      <PullToRefresh>
        <p>一覧</p>
      </PullToRefresh>
    );
    const node = container();
    touch(node, "touchstart", 100);
    touch(node, "touchmove", 100 + ENOUGH / 2);
    const gear = document.querySelector("[data-pull-gear]") as HTMLElement;
    // 半分まで引いた → 半回転・濃さ 0.5
    expect(gear.style.transform).toBe("rotate(180deg)");
    expect(gear.style.opacity).toBe("0.5");
  });

  it("中身はいつも描かれる（包んだだけで見えなくならない）", () => {
    render(
      <PullToRefresh>
        <p>一覧</p>
      </PullToRefresh>
    );
    expect(screen.getByText("一覧")).toBeInTheDocument();
  });
});

describe("動きを減らす設定・無限スクロールとの関係", () => {
  const source = readFileSync("src/components/layout/PullToRefresh.tsx", "utf8");

  it("prefers-reduced-motion のときは歯車を回さず、出すだけにする", () => {
    expect(source).toContain("motion-reduce:animate-none");
  });

  it("引いている間はブラウザの跳ね返りを止める（歯車と二重に動かさない）", () => {
    // React の onTouchMove では効かないので、自分で「受け身でない」聞き役を登録している
    expect(source).toContain("{ passive: false }");
    expect(source).toContain("event.preventDefault()");
  });

  it("取り直しの終わりは useTransition で見ている（router.refresh は終わりを返さない）", () => {
    expect(source).toContain("useTransition");
    expect(source).toContain("startTransition(() => router.refresh())");
  });
});

describe("付ける 6 画面・付けない 3 枚", () => {
  const read = (p: string) => readFileSync(p, "utf8");

  it("付けるのは 6 画面", () => {
    const placed = [
      "src/components/notifications/NotificationListScreen.tsx",
      "src/components/mypage/MyPageScreen.tsx",
      "src/components/itineraries/ItineraryListScreen.tsx",
      "src/app/albums/page.tsx",
      "src/components/wishlist/WishlistScreen.tsx",
      // #673・#675（2026-10-04）: 検索結果は SpotSearchScreen。
      // 2026-10-02 に PostSearchScreen（スポット別の投稿一覧）と取り違えて包んでいた
      "src/components/posts/SpotSearchScreen.tsx",
    ];
    for (const p of placed) {
      expect(read(p), `${p} に付いていない`).toContain("<PullToRefresh>");
    }
    expect(placed).toHaveLength(6);
  });

  it("付けない 3 枚には付けない（いちばん上で下に引くが既に「地図を出す」の意味を持つ）", () => {
    // 上 1/3 地図＋下 2/3 シートが scroll-snap の入れ物になっている（要件 4.5.6）。
    // 同じ操作に 2 つの意味を重ねない
    for (const p of [
      "src/components/posts/SpotPostListScreen.tsx",
      /*
       * #675（2026-10-04）: 中身の方も見る。
       *
       * 【初心者向け】スポット別の投稿一覧は「枠（SpotPostListScreen）＋中身（PostSearchScreen）」の
       * 2 ファイルでできている。枠だけ見ていたので、**中身に付いていたのを 2 日間見逃した**。
       */
      "src/components/posts/PostSearchScreen.tsx",
      "src/components/posts/PostDetailScreen.tsx",
      "src/components/itineraries/ItineraryDetailScreen.tsx",
    ]) {
      expect(read(p), `${p} に付いている`).not.toContain("PullToRefresh");
    }
  });
});
