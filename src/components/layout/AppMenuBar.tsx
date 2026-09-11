"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import { MENU_ITEMS, isMenuItemActive, shouldShowMenuBar, type MenuItem } from "./menu-bar-config";

/**
 * 共通メニューバー Task1〜3
 * 出典: docs/tasks/shared-ui/menu-bar/01-menu-bar-component.md
 *       docs/tasks/shared-ui/menu-bar/02-unread-notification-badge.md
 *       docs/tasks/shared-ui/menu-bar/03-admin-access-control.md
 *
 * スマートフォンでは画面下部に固定、PCでは上部に置く（2.3の両環境に対応）。
 * 管理画面への導線はここには置かない（Task3）。is_adminユーザー向けの導線は
 * プロフィール編集画面（SC-07）側にある。
 */
async function fetchUnreadCountFromApi(): Promise<number> {
  const response = await fetchWithAuthRedirect("/api/notifications/unread-count");
  if (!response.ok) {
    return 0;
  }
  const data = (await response.json()) as { unreadCount: number };
  return data.unreadCount;
}

function MenuIcon({ itemKey }: { itemKey: MenuItem["key"] }) {
  const common = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", "aria-hidden": true };
  switch (itemKey) {
    case "map":
      return (
        <svg {...common}>
          <path d="M12 21s-6-5.3-6-11a6 6 0 0 1 12 0c0 5.7-6 11-6 11z" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="12" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      );
    case "post":
      return (
        <svg {...common}>
          <rect x="4" y="4" width="16" height="16" rx="4" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "notifications":
      return (
        <svg {...common}>
          <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M10 20a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      );
    case "mypage":
      return (
        <svg {...common}>
          <circle cx="12" cy="8.5" r="3.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
  }
}

export function UnreadBadge({ count }: { count: number }) {
  // Task2: 0件のときは出さない
  if (count <= 0) {
    return null;
  }
  return (
    <span
      aria-label={`未読${count}件`}
      className="absolute -right-2 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#C4703F] px-1 text-[10px] font-bold leading-none text-white"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function AppMenuBar({
  fetchUnreadCount = fetchUnreadCountFromApi,
}: {
  /** 未読件数取得の差し替え口（単体テスト用） */
  fetchUnreadCount?: () => Promise<number>;
}) {
  const pathname = usePathname();
  const visible = shouldShowMenuBar(pathname);
  const [unreadCount, setUnreadCount] = useState(0);

  // 呼び出し元がインライン関数を渡しても効果が再実行されないようrefで受ける
  const fetchUnreadCountRef = useRef(fetchUnreadCount);
  useEffect(() => {
    fetchUnreadCountRef.current = fetchUnreadCount;
  }, [fetchUnreadCount]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    fetchUnreadCountRef
      .current()
      .then((count) => {
        if (!cancelled) setUnreadCount(count);
      })
      .catch((error) => {
        if (error instanceof UnauthorizedError) return;
        // 件数が取れなくてもメニュー自体は使えるので、バッジを出さないだけにする
      });

    return () => {
      cancelled = true;
    };
    // 画面遷移のたびに件数を取り直す（通知一覧で既読にした直後などに反映させるため）
  }, [visible, pathname]);

  if (!visible) {
    return null;
  }

  return (
    <nav
      aria-label="メインメニュー"
      data-menu-bar
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E8E1D8] bg-white/95 backdrop-blur md:inset-x-auto md:bottom-auto md:left-0 md:top-0 md:h-full md:w-[200px] md:border-r md:border-t-0"
    >
      <ul className="flex h-[60px] items-stretch justify-around md:h-auto md:flex-col md:items-stretch md:justify-start md:gap-1 md:p-4">
        {MENU_ITEMS.map((item) => {
          const active = isMenuItemActive(item, pathname);
          return (
            <li key={item.key} className="flex-1 md:flex-none">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-full flex-col items-center justify-center gap-0.5 text-[10px] font-medium md:h-11 md:flex-row md:justify-start md:gap-3 md:rounded-[10px] md:px-3 md:text-[13px] ${
                  active ? "text-[#C4703F] md:bg-[#FBF6F0]" : "text-[#9C9488] hover:text-[#3D3A35]"
                }`}
              >
                <span className="relative">
                  <MenuIcon itemKey={item.key} />
                  {item.key === "notifications" && <UnreadBadge count={unreadCount} />}
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
