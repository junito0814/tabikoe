"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import { MENU_ITEMS, isMenuItemActive, shouldShowMenuBar, type MenuItem } from "./menu-bar-config";
import { NOTIFICATIONS_READ_EVENT } from "@/components/notifications/notification-events";

/**
 * 共通メニューバー Task1〜3
 * 出典: docs/tasks/shared-ui/menu-bar/01-menu-bar-component.md
 *       docs/tasks/shared-ui/menu-bar/02-unread-notification-badge.md
 *       docs/tasks/shared-ui/menu-bar/03-admin-access-control.md
 *
 * スマートフォンでは画面下部に固定、PC（md 以上）では左サイドバーに縦に並べる（2.3の両環境に対応。menu-bar-v3 Task2）。
 * 管理画面への導線はここには置かない（Task3）。is_adminユーザー向けの導線は
 * プロフィール編集画面（SC-07）側にある。
 *
 * 【初心者向け】メニューの中身（項目・遷移先・どのパスで出すか）は menu-bar-config.ts に分けてある。
 * このファイルは「描画」と「未読バッジの取得」だけ。`usePathname()` で今の URL を見て、出す／出さない・選択中を決める。
 * v3.0 で項目は ホーム（家のアイコン）・しおり・通知・マイページ（menu-bar-v3 Task1）。
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
    case "home":
      // 家のアイコン（ホーム＝検索トップ）
      return (
        <svg {...common}>
          <path d="M3 11.5L12 4l9 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5.5 10.5V20h13v-9.5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M10 20v-6h4v6" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      );
    case "itineraries":
      /*
       * #802（2026-10-06）: ~~ブックマーク~~ → **旅程（2 点を点線で結ぶ道筋）**。
       *
       * 【初心者向け】ブックマークの形は、ほとんどのアプリで「**保存した**」を意味する
       * （Instagram の保存・X のブックマーク）。タビコエで「保存」にあたるのは
       * 行きたい（♡）なので、計画にブックマークを使うと逆に読まれる。
       * 「どこからどこへ回るか」を表す道筋にした。
       */
      return (
        <svg {...common}>
          <circle cx="6" cy="6.5" r="2.5" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="18" cy="17.5" r="2.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="M8.2 8c4 0 3.6 8.4 7.6 8.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="2.5 2.5" />
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
      className="absolute -right-2 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[0.625rem] font-bold leading-none text-white"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

/** 未読件数の再取得はこの間隔で 1 回（performance Task1） */
export const UNREAD_COUNT_TTL_MS = 60 * 1000;

/** 前回の取得から TTL を過ぎていれば取り直す（純粋関数。未取得なら true） */
export function shouldRefetchUnreadCount(fetchedAt: number | null, now: number): boolean {
  return fetchedAt === null || now - fetchedAt >= UNREAD_COUNT_TTL_MS;
}

/** 直近の未読件数（画面遷移をまたいで使い回す） */
const unreadCache: { count: number; fetchedAt: number | null } = { count: 0, fetchedAt: null };

/** 単体テスト用: キャッシュを消す */
export function resetUnreadCountCache(): void {
  unreadCache.count = 0;
  unreadCache.fetchedAt = null;
}

export function AppMenuBar({
  fetchUnreadCount = fetchUnreadCountFromApi,
  isAuthenticated = true,
}: {
  /** 未読件数取得の差し替え口（単体テスト用） */
  fetchUnreadCount?: () => Promise<number>;
  /** layout.tsx がサーバーで判定して渡す。未ログインのホーム（/）ではバーを出さない */
  isAuthenticated?: boolean;
}) {
  const pathname = usePathname();
  const visible = shouldShowMenuBar(pathname, isAuthenticated);
  const [unreadCount, setUnreadCount] = useState(0);

  // 呼び出し元がインライン関数を渡しても効果が再実行されないようrefで受ける
  const fetchUnreadCountRef = useRef(fetchUnreadCount);
  useEffect(() => {
    fetchUnreadCountRef.current = fetchUnreadCount;
  }, [fetchUnreadCount]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    // performance Task1: 画面遷移のたびに API を呼ぶと 1 本 0.3 秒かかるので、前回から 60 秒以内なら取り直さない
    // （直近の値はモジュール内に持つ。既読イベントのときは必ず取り直す）
    const refresh = (force = false) => {
      if (!force && !shouldRefetchUnreadCount(unreadCache.fetchedAt, Date.now())) {
        setUnreadCount(unreadCache.count);
        return;
      }
      fetchUnreadCountRef
        .current()
        .then((count) => {
          unreadCache.count = count;
          unreadCache.fetchedAt = Date.now();
          if (!cancelled) setUnreadCount(count);
        })
        .catch((error) => {
          if (error instanceof UnauthorizedError) return;
          // 件数が取れなくてもメニュー自体は使えるので、バッジを出さないだけにする
        });
    };
    refresh();
    // F-NT-02 Task3: 通知一覧で既読化した直後にも取り直す
    const onRead = () => refresh(true);
    window.addEventListener(NOTIFICATIONS_READ_EVENT, onRead);

    return () => {
      cancelled = true;
      window.removeEventListener(NOTIFICATIONS_READ_EVENT, onRead);
    };
  }, [visible, pathname]);

  if (!visible) {
    return null;
  }

  return (
    <nav
      aria-label="メインメニュー"
      data-menu-bar
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur md:inset-x-auto md:bottom-auto md:left-0 md:top-0 md:h-full md:w-[200px] md:border-r md:border-t-0"
    >
      <ul className="flex h-[60px] items-stretch justify-around md:h-auto md:flex-col md:items-stretch md:justify-start md:gap-1 md:p-4">
        {MENU_ITEMS.map((item) => {
          const active = isMenuItemActive(item, pathname);
          return (
            <li key={item.key} className="flex-1 md:flex-none">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-full flex-col items-center justify-center gap-0.5 text-[0.625rem] font-medium md:h-11 md:flex-row md:justify-start md:gap-3 md:rounded-[10px] md:px-3 md:text-[0.8125rem] ${
                  active ? "text-accent md:bg-tint" : "text-muted hover:text-ink"
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
