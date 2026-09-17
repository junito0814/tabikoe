import Link from "next/link";

/**
 * F-RC-01 Task4 / my-page-v3 Task1（v3.0）: 遷移メニュー（行きたい／アルバム／マイマップ／バッジ）
 * 出典: docs/tasks/records/my-page/04-navigation-menu-links.md
 *       docs/tasks/records/my-page-v3/01-drafts-section-and-menu.md
 *       要件定義書 v3.0 3.6.1・4.2
 *
 * 【初心者向け】4 つだけ。しおりはメニューバー（旅行と結びつくもの）へ移し、ここには置かない
 * （自分の手元にあるもの＝行きたい・アルバム・マイマップ・バッジ）。
 */
export const MY_PAGE_MENU = [
  { key: "wishlist", label: "行きたい", href: "/wishlist" },
  { key: "albums", label: "アルバム", href: "/albums" },
  { key: "mymap", label: "マイマップ", href: "/mymap" },
  { key: "badges", label: "バッジ", href: "/badges" },
] as const;

export function MyPageMenu({ wishlistCount }: { wishlistCount?: number }) {
  return (
    <nav aria-label="マイページメニュー">
      <ul className="grid grid-cols-2 gap-2">
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
