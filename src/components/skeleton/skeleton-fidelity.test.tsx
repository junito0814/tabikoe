import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { ItineraryListSkeleton, MyPageSkeleton, NotificationListSkeleton } from "./Skeletons";

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
