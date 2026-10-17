import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * 出典: #901（2026-10-17）器を関数抜きで配れるようにする
 *
 * 【初心者向け】いちばん大事なのは **`RootLayout` が Cookie を待たないこと**です。
 * 待つと（`await` すると）Next.js は**どのページの器も静的に作れません**。
 * ログイン状態の確認そのものは `MenuBarSlot`（`<Suspense>` の中）へ移したので、
 * ここでは「**待っていない**」ことと「メニューバーの場所が `<Suspense>` の中にある」ことを見ます。
 */
vi.mock("@/components/layout/MenuBarSlot", () => ({ MenuBarSlot: () => <div data-menu-slot /> }));
// 2026-10-06: フォントはビルド時処理（.woff2 を読む）なので、テストでは差し替える
vi.mock("@/app/fonts", () => ({
  outfit: { className: "outfit", variable: "outfit" },
  lora: { className: "lora", variable: "lora" },
  geistSans: { className: "geist-sans", variable: "geist-sans" },
  geistMono: { className: "geist-mono", variable: "geist-mono" },
}));

import RootLayout from "./layout";

describe("RootLayout（共通レイアウト）", () => {
  it("Cookie を待たない（器を静的に作れるようにするため）", () => {
    // async 関数なら呼んだ結果が Promise になる。同期であることがこのテストの主眼
    const element = RootLayout({ children: null, params: Promise.resolve({}) });
    expect(element).not.toBeInstanceOf(Promise);
  });

  it("メニューバーを置いている（Suspense の中で描かれる）", () => {
    const element = RootLayout({ children: null, params: Promise.resolve({}) }) as React.ReactElement;
    // 実際に描いて確かめる。Suspense の中の部品は、描かないと文字に出てこない
    expect(renderToStaticMarkup(element)).toContain("data-menu-slot");
  });
});
