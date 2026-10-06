import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import {
  AlbumDetailSkeleton,
  AlbumListSkeleton,
  ItineraryDetailSkeleton,
  ItineraryListSkeleton,
  MyPageSkeleton,
  NotificationListSkeleton,
  PostSearchSkeleton,
  WishlistSkeleton,
} from "./Skeletons";

/**
 * 出典: docs/tasks/shared-ui/loading-feedback/11-skeleton-fidelity.md 単体テスト
 *       #650（骨組みと本物がずれていて、読み込みが終わると画面が動く）
 * 要件定義書 4.5.11 共通の決まり「骨組みは本物と同じ形にする」・8 章 99
 *
 * 【初心者向け】ここでいちばん大事なのは「**本物と同じ値か**」。
 * 骨組みと本物がずれていると、読み込みが終わった瞬間に画面が動く。
 * 見た目は機械で測れないので、**本物のファイルから値を読んで突き合わせる**。
 * こうしておくと、どちらかだけ直したときにテストが止める。
 */
const skeletons = readFileSync("src/components/skeleton/Skeletons.tsx", "utf8");
const real = {
  通知: readFileSync("src/components/notifications/NotificationListScreen.tsx", "utf8"),
  しおり: readFileSync("src/components/itineraries/ItineraryListScreen.tsx", "utf8"),
  マイページ: readFileSync("src/components/mypage/MyPageScreen.tsx", "utf8"),
};

/** 骨組みの関数 1 つぶんの中身を取り出す */
function part(name: string): string {
  const start = skeletons.indexOf(`export function ${name}(`);
  expect(start, `${name} が見つからない`).toBeGreaterThan(-1);
  const end = skeletons.indexOf("\nexport function ", start + 1);
  return skeletons.slice(start, end === -1 ? undefined : end);
}

describe("外枠が本物と同じ（#650 の「幅が 40px 広がる」）", () => {
  it.each(Object.entries(real))("%s の本物は max-w-[520px] を使っている", (_name, source) => {
    expect(source).toContain("max-w-[520px]");
  });

  it("骨組みの外枠も max-w-[520px]（560px ではない）", () => {
    const frame = skeletons.slice(skeletons.indexOf("function ScreenFrame("));
    expect(frame).toContain("max-w-[520px]");
    expect(frame).toContain("px-4 py-6");
  });
});

describe("見出しが本物と同じ（#650 の「中央から左へ飛ぶ」）", () => {
  it("骨組みの見出しは左寄せ 18px（中央寄せではない）", () => {
    const heading = skeletons.slice(skeletons.indexOf("function HeadingLeft("), skeletons.indexOf("function HeadingLeft(") + 600);
    expect(heading).toContain('text-[18px] font-bold text-ink');
    expect(heading).not.toContain("text-center");
  });

  it.each(["通知", "しおり"])("%s の本物も左寄せ 18px", (name) => {
    expect(real[name as keyof typeof real]).toContain('<h1 className="text-[18px] font-bold text-ink">');
  });
});

describe("マイページには見出しを出さない（#650 でいちばんひどかった点）", () => {
  it("本物に「マイページ」という見出しは無い", () => {
    // 出るのはアイコン（64px の丸）＋ユーザー名
    expect(real.マイページ).not.toContain(">マイページ<");
    expect(real.マイページ).toContain("h-16 w-16 rounded-full");
  });

  it("骨組みも「マイページ」という文字を出さない", () => {
    render(<MyPageSkeleton />);
    expect(screen.queryByText("マイページ")).toBeNull();
    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("骨組みは丸いアイコンの形から始まる（本物と同じ 64px）", () => {
    expect(part("MyPageSkeleton")).toContain("h-16 w-16 shrink-0 rounded-full");
  });
});

describe("左右のボタンの有無が本物と同じ", () => {
  it("通知には戻るも右のボタンも無い", () => {
    const { container } = render(<NotificationListSkeleton />);
    // 見出しの行に入っている要素は見出しだけ
    const headRow = container.querySelector("h1")!.parentElement!;
    expect(headRow.children).toHaveLength(1);
  });

  it("しおりには右のボタンがある（本物の「＋ 新規」）", () => {
    expect(real.しおり).toContain("＋ 新規");
    const { container } = render(<ItineraryListSkeleton />);
    const headRow = container.querySelector("h1")!.parentElement!;
    expect(headRow.children).toHaveLength(2);
  });
});

describe("読み込んでいると伝わる形は残っている", () => {
  it.each([
    ["通知", NotificationListSkeleton],
    ["しおり", ItineraryListSkeleton],
    ["マイページ", MyPageSkeleton],
  ])("%s の骨組みに role=status がある", (_name, Skeleton) => {
    render(<Skeleton />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-label", "読み込んでいます");
  });
});

describe("Task 11: シマー（光が流れる動き）", () => {
  const css = readFileSync("src/app/globals.css", "utf8");

  it("骨組みの箱がシマーを使っている（animate-pulse ではない）", () => {
    const block = skeletons.slice(skeletons.indexOf("export function SkeletonBlock("), skeletons.indexOf("export function SkeletonBlock(") + 800);
    expect(block).toContain("skeleton-block");
    expect(block).not.toContain("animate-pulse rounded");
  });

  it("周期は 1.2 秒（実際の待ち 0.5〜1.5 秒に合わせてある）", () => {
    // animate-pulse の 2 秒では、0.6 秒の待ちで透明度が 1 → 0.9 までしか動かず止まって見えた
    expect(css).toContain("animation: skeleton-shimmer 1.2s ease-in-out infinite");
  });

  it("光が左から右へ流れる", () => {
    expect(css).toMatch(/@keyframes skeleton-shimmer\s*\{[\s\S]*?translateX\(100%\)/);
    expect(css).toMatch(/\.skeleton-block::after\s*\{[\s\S]*?translateX\(-100%\)/);
  });

  it("動きを減らす設定のときは止まる", () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.skeleton-block::after\s*\{\s*animation: none/);
  });
});

/**
 * 出典: #653（残り 5 画面の骨組みも本物とずれている）
 * 要件定義書 4.5.11 共通の決まり「骨組みは本物と同じ形にする」
 *
 * 【初心者向け】3 画面と同じ考え方で、残り 5 画面も本物と突き合わせる。
 * **外枠の余白と幅が画面ごとに違う**のがこの 5 つの難しいところで、
 * そこがずれると読み込みが終わった瞬間に画面全体が動く。
 */
const real5 = {
  アルバム一覧: readFileSync("src/app/albums/page.tsx", "utf8"),
  行きたい: readFileSync("src/components/wishlist/WishlistScreen.tsx", "utf8"),
  検索結果: readFileSync("src/components/posts/PostSearchScreen.tsx", "utf8"),
  アルバム詳細: readFileSync("src/components/albums/AlbumScreen.tsx", "utf8"),
  しおり詳細: readFileSync("src/components/itineraries/ItineraryDetailScreen.tsx", "utf8"),
};

describe("#653: 残り 5 画面の外枠が本物と同じ", () => {
  it.each([
    ["アルバム一覧", "AlbumListSkeleton", "px-4 py-6", "max-w-[560px]"],
    ["行きたい", "WishlistSkeleton", "px-4 pt-4 pb-8", "max-w-[520px]"],
    ["検索結果", "PostSearchSkeleton", "bg-app pb-6", "max-w-[520px] px-4 pt-4"],
    ["アルバム詳細", "AlbumDetailSkeleton", "px-4 py-6", "max-w-[560px]"],
    ["しおり詳細", "ItineraryDetailSkeleton", "px-4 pt-4 pb-24", "max-w-[520px]"],
  ])("%s: 骨組みと本物が同じ余白・同じ幅", (name, fn, padding, width) => {
    const skeleton = part(fn);
    expect(skeleton, `${name} の余白`).toContain(padding);
    expect(skeleton, `${name} の幅`).toContain(width.split(" ")[0]);
    // 本物にも同じ値があること（片方だけ直したらここで止まる）
    const source = real5[name as keyof typeof real5];
    expect(source, `${name} の本物の幅`).toContain(width.split(" ")[0]);
    expect(source, `${name} の本物の余白`).toContain(padding);
  });
});

describe("#653: アルバム詳細の形（いちばんずれていた）", () => {
  it("本物は戻るが独立した 1 行で、その下に 20px のタイトル", () => {
    // #813: 下線付きの「← 一覧」をやめ、共通部品（BackLink）に揃えた
    expect(real5.アルバム詳細).toContain("<BackLink");
    expect(real5.アルバム詳細).toContain("text-[20px] font-bold text-ink");
  });

  it("骨組みも 2 段（戻る → タイトル）になっている", () => {
    const { container } = render(<AlbumDetailSkeleton />);
    const header = container.querySelector("header")!;
    expect(header.className).toContain("flex-col");
    expect(header.children).toHaveLength(2);
  });
});

describe("#653: 切替の行がある（行きたい・検索結果）", () => {
  it("行きたいに一覧・地図の切替がある", () => {
    expect(real5.行きたい).toContain('role="radiogroup"');
    expect(part("WishlistSkeleton")).toContain("rounded-full border border-line bg-surface p-0.5");
  });

  it("検索結果に表示切替と並び替えの行がある", () => {
    expect(real5.検索結果).toContain("<ViewToggle");
    expect(real5.検索結果).toContain("<SortDropdown");
    expect(part("PostSearchSkeleton")).toContain("flex items-center justify-between gap-2");
  });
});

describe("#653: しおり詳細の右のボタンは 2 つ", () => {
  it("本物に「地図で見る」と「⋯」がある", () => {
    expect(real5.しおり詳細).toContain("地図で見る");
    expect(real5.しおり詳細).toContain('aria-label="その他"');
  });

  it("骨組みの見出しの行も 4 つ（戻る・題名・地図・その他）", () => {
    const { container } = render(<ItineraryDetailSkeleton />);
    const row = container.querySelector("header > div")!;
    expect(row.children).toHaveLength(4);
  });
});

describe("#653: 読み込んでいると伝わる形は 5 枚とも残っている", () => {
  it.each([
    ["アルバム一覧", AlbumListSkeleton],
    ["行きたい", WishlistSkeleton],
    ["検索結果", PostSearchSkeleton],
    ["アルバム詳細", AlbumDetailSkeleton],
    ["しおり詳細", ItineraryDetailSkeleton],
  ])("%s", (_name, Skeleton) => {
    render(<Skeleton />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-label", "読み込んでいます");
  });
});

describe("#653: 共通の ListScreenSkeleton はもう画面に使っていない", () => {
  it("8 つの loading.tsx はすべて専用の骨組みを使っている", () => {
    const routes = [
      ["notifications", "NotificationListSkeleton"],
      ["itineraries", "ItineraryListSkeleton"],
      ["mypage", "MyPageSkeleton"],
      ["albums", "AlbumListSkeleton"],
      ["wishlist", "WishlistSkeleton"],
      ["search", "PostSearchSkeleton"],
      ["albums/[id]", "AlbumDetailSkeleton"],
      ["itineraries/[id]", "ItineraryDetailSkeleton"],
    ];
    for (const [route, fn] of routes) {
      const source = readFileSync(`src/app/${route}/loading.tsx`, "utf8");
      expect(source, `${route} が ${fn} を使っていない`).toContain(`<${fn} />`);
    }
  });

  it("検索のページ内の待ちも専用の骨組みを使っている", () => {
    // ここも本物とずれていた（幅も中身も）。loading.tsx と同じものに揃える
    expect(readFileSync("src/app/search/page.tsx", "utf8")).toContain("<PostSearchSkeleton />");
  });
});
