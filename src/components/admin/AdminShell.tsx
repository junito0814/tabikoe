"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "@/app/account/logout-button";
import {
  ADMIN_MENU_ITEMS,
  ADMIN_MOBILE_KEYS,
  ADMIN_MORE_HREF,
  adminMenuItem,
  adminPageTitle,
  formatBadgeCount,
  isAdminMenuItemActive,
  isAdminMoreActive,
  type AdminBadgeCounts,
  type AdminMenuItem,
  type AdminMenuKey,
} from "./admin-menu-config";

/**
 * admin-shell-dashboard Task 1: 管理画面の共通の枠（左メニュー・上のバー・スマホの下のバー）
 * 出典: docs/tasks/admin/admin-shell-dashboard/01-admin-shell.md
 *       要件定義書 3.10.2、docs/wireframes.md「管理画面 › 共通の枠」「スマホでの管理画面」
 *       見た目: https://claude.ai/artifact/KoY91teZdaTPQahdk2LEhM
 *
 * 【初心者向け】この部品は src/app/admin/layout.tsx から呼ばれ、/admin 配下の全ページを包む。
 * 件数（未対応の通報など）と管理者名はサーバー側の layout が取って props で渡す。ここは「今どのページか」を
 * usePathname() で見て、選択中の項目と上のバーの画面名を決めるだけ。
 * 利用者向けの AppMenuBar は /admin 配下では出ない（menu-bar-config の HIDDEN_PREFIXES）ので、
 * 余白の確保もこの部品が自分で行う（パソコンは左 220px、スマホは下 60px）。
 */
export function AdminShell({
  adminName,
  badges,
  children,
}: {
  adminName: string;
  badges: AdminBadgeCounts;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const title = adminPageTitle(pathname);

  return (
    <div className="flex min-h-screen w-full bg-app">
      {/* パソコン: 左メニュー（7 項目） */}
      <nav
        aria-label="管理メニュー"
        data-admin-menu
        className="fixed inset-y-0 left-0 z-40 hidden w-[220px] flex-col border-r border-line bg-surface md:flex"
      >
        <div className="px-5 pb-3 pt-5">
          <p className="text-[0.9375rem] font-bold text-ink">タビコエ</p>
          <p className="text-[0.6875rem] font-medium tracking-wide text-muted">管理</p>
        </div>
        <ul className="flex flex-col gap-0.5 px-3">
          {ADMIN_MENU_ITEMS.map((item) => (
            <li key={item.key}>
              <SideLink item={item} pathname={pathname} badges={badges} />
            </li>
          ))}
        </ul>
        <div className="mt-auto px-3 pb-5">
          <Link href="/" className="flex h-10 items-center gap-2 rounded-[10px] px-3 text-[0.8125rem] text-muted hover:text-ink">
            ← サイトへ戻る
          </Link>
        </div>
      </nav>

      {/* 本体（上のバー＋各ページ） */}
      <div className="flex min-w-0 flex-1 flex-col pb-[60px] md:pb-0 md:pl-[220px]">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-surface/95 px-4 backdrop-blur md:px-6">
          <h1 className="truncate text-[1rem] font-bold text-ink">{title}</h1>
          <div className="flex shrink-0 items-center gap-3 text-[0.75rem] text-muted">
            <span className="hidden sm:inline">
              {adminName}
              <span className="ml-1 rounded-full border border-line px-1.5 py-0.5 text-[0.625rem]">管理者</span>
            </span>
            <LogoutButton />
          </div>
        </header>
        <main className="flex w-full flex-1 flex-col px-4 py-4 md:px-6 md:py-6">{children}</main>
      </div>

      {/* スマホ: 下のバー（4 項目＋その他）。利用者向けのバーと同じ高さ・並び */}
      <nav
        aria-label="管理メニュー（スマホ）"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur md:hidden"
      >
        <ul className="flex h-[60px] items-stretch justify-around">
          {ADMIN_MOBILE_KEYS.map((key) => (
            <li key={key} className="flex-1">
              <BottomLink item={adminMenuItem(key)} pathname={pathname} badges={badges} />
            </li>
          ))}
          <li className="flex-1">
            <BottomLink
              item={{ key: "more", label: "その他", href: ADMIN_MORE_HREF }}
              pathname={pathname}
              badges={badges}
              active={isAdminMoreActive(pathname)}
              badgeCount={badges.hidden}
            />
          </li>
        </ul>
      </nav>
    </div>
  );
}

function badgeCountOf(item: { badge?: AdminMenuItem["badge"] }, badges: AdminBadgeCounts): number {
  return item.badge ? badges[item.badge] : 0;
}

/** 赤い丸。0 のときは出さない */
function CountBadge({ count, inline = false }: { count: number; inline?: boolean }) {
  const text = formatBadgeCount(count);
  if (!text) return null;
  return (
    <span
      aria-label={`${count}件`}
      className={`flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[0.625rem] font-bold leading-none text-white ${
        inline ? "" : "absolute -right-2 -top-1"
      }`}
    >
      {text}
    </span>
  );
}

function SideLink({ item, pathname, badges }: { item: AdminMenuItem; pathname: string; badges: AdminBadgeCounts }) {
  const active = isAdminMenuItemActive(item, pathname);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`flex h-10 items-center justify-between gap-3 rounded-[10px] px-3 text-[0.8125rem] font-medium ${
        active ? "bg-tint text-accent" : "text-muted hover:text-ink"
      }`}
    >
      <span className="flex items-center gap-2">
        <MenuIcon itemKey={item.key} />
        {item.label}
      </span>
      <CountBadge count={badgeCountOf(item, badges)} inline />
    </Link>
  );
}

function BottomLink({
  item,
  pathname,
  badges,
  active = isAdminMenuItemActive(item as AdminMenuItem, pathname),
  badgeCount = badgeCountOf(item, badges),
}: {
  item: { key: AdminMenuKey | "more"; label: string; shortLabel?: string; href: string; badge?: AdminMenuItem["badge"] };
  pathname: string;
  badges: AdminBadgeCounts;
  active?: boolean;
  badgeCount?: number;
}) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`relative flex h-full flex-col items-center justify-center gap-0.5 text-[0.625rem] font-medium ${
        active ? "text-accent" : "text-muted hover:text-ink"
      }`}
    >
      <span className="relative">
        <MenuIcon itemKey={item.key} />
        <CountBadge count={badgeCount} />
      </span>
      {item.shortLabel ?? item.label}
    </Link>
  );
}

/** 線画のアイコン（利用者向けのバーと同じ太さ 1.8） */
function MenuIcon({ itemKey }: { itemKey: AdminMenuKey | "more" }) {
  const common = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", "aria-hidden": true, stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (itemKey) {
    case "dashboard":
      return (
        <svg {...common}>
          <rect x="4" y="4" width="7" height="7" rx="1.5" />
          <rect x="13" y="4" width="7" height="7" rx="1.5" />
          <rect x="4" y="13" width="7" height="7" rx="1.5" />
          <rect x="13" y="13" width="7" height="7" rx="1.5" />
        </svg>
      );
    case "reports":
      return (
        <svg {...common}>
          <path d="M5 4h9l5 5v11H5z" />
          <path d="M12 10v4M12 17h.01" />
        </svg>
      );
    case "users":
      return (
        <svg {...common}>
          <circle cx="9" cy="8.5" r="3.2" />
          <path d="M3.5 19c0-3.2 2.5-5.3 5.5-5.3s5.5 2.1 5.5 5.3" />
          <circle cx="17" cy="9.5" r="2.4" />
          <path d="M16 13.8c2.6 0 4.5 1.7 4.5 4.6" />
        </svg>
      );
    case "hidden":
      return (
        <svg {...common}>
          <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z" />
          <path d="M4 4l16 16" />
        </svg>
      );
    case "announcements":
      return (
        <svg {...common}>
          <path d="M4 10v4h3l7 4V6l-7 4H4z" />
          <path d="M17 9.5a3.5 3.5 0 0 1 0 5" />
        </svg>
      );
    case "legal":
      return (
        <svg {...common}>
          <path d="M6 3h9l4 4v14H6z" />
          <path d="M9 11h7M9 15h7" />
        </svg>
      );
    case "actions":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4l3 2" />
        </svg>
      );
    case "more":
      return (
        <svg {...common}>
          <circle cx="6" cy="12" r="1.2" fill="currentColor" />
          <circle cx="12" cy="12" r="1.2" fill="currentColor" />
          <circle cx="18" cy="12" r="1.2" fill="currentColor" />
        </svg>
      );
  }
}
