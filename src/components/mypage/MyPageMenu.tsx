import Link from "next/link";

/**
 * F-RC-01 Task4 / my-page-v3 Task1（v3.0）: 遷移メニュー（行きたい／アルバム／あしあと／バッジ）
 * 出典: docs/tasks/records/my-page/04-navigation-menu-links.md
 *       docs/tasks/records/my-page-v3/01-drafts-section-and-menu.md
 *       要件定義書 v3.0 3.6.1・4.2
 *
 * 【初心者向け】4 つだけ。しおりはメニューバー（旅行と結びつくもの）へ移し、ここには置かない
 * （自分の手元にあるもの＝行きたい・アルバム・投稿履歴）。#683 でバッジは外し、プロフィールの下の 1 行にした。
 * #684（2026-10-05）: 「アカウントの状態」（SC-28）は廃止した。制限は通知で伝える（決定事項 72）。
 */
export const MY_PAGE_MENU = [
  { key: "wishlist", label: "行きたい", href: "/wishlist" },
  { key: "albums", label: "アルバム", href: "/albums" },
  // #682: 「あしあと」→「投稿履歴」に改称（URL は変えない）
  { key: "mymap", label: "投稿履歴", href: "/mymap" },
] as const;

export function MyPageMenu({ wishlistCount }: { wishlistCount?: number }) {
  return (
    <nav aria-label="マイページメニュー">
      {/* #683: 3 つなので 3 列（2 列だと 1 つだけ次の行に余る。2026-10-05 の撮影で見つけた） */}
      <ul className="grid grid-cols-3 gap-2">
        {MY_PAGE_MENU.map((item) => (
          <li key={item.key}>
            <Link href={item.href} className="flex h-12 items-center justify-center gap-1.5 rounded-[10px] border border-line bg-surface text-[13px] font-semibold text-ink">
              {item.label}
              {item.key === "wishlist" && typeof wishlistCount === "number" && <span className="text-[11px] text-muted">{wishlistCount}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
