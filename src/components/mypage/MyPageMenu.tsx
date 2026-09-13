import Link from "next/link";

/**
 * F-RC-01 Task4: 遷移メニュー（アルバム／マイマップ／「行きたい」／ステータスバッジ）
 * 出典: docs/tasks/records/my-page/04-navigation-menu-links.md
 *       要件定義書3.6.1・4.2（マイマップへはメニューバーでなくここから遷移する）
 */
export const MY_PAGE_MENU = [
  { key: "albums", label: "アルバム", href: "/albums" },
  { key: "mymap", label: "マイマップ", href: "/mymap" },
  { key: "wishlist", label: "行きたいスポット", href: "/wishlist" },
  { key: "badges", label: "ステータスバッジ", href: "/badges" },
] as const;

export function MyPageMenu() {
  return (
    <nav aria-label="マイページメニュー">
      <ul className="grid grid-cols-2 gap-2">
        {MY_PAGE_MENU.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              className="flex h-12 items-center justify-center rounded-[10px] border border-[#E8E1D8] bg-white text-[13px] font-semibold text-[#3D3A35]"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
