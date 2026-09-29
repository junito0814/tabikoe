/**
 * admin-shell-dashboard Task 1: 管理画面のメニュー定義と判定
 * 出典: docs/tasks/admin/admin-shell-dashboard/01-admin-shell.md
 *       要件定義書 3.10.2「管理画面の枠」、docs/wireframes.md「管理画面 › 共通の枠」
 *
 * 【初心者向け】利用者向けの menu-bar-config.ts と同じ分け方。「項目・遷移先・どれが選択中か」だけをここに置き、
 * 描画は AdminShell.tsx が担当する。ここは DOM を使わない純粋関数なので、単体テストが軽い。
 * パソコンは 7 項目の左メニュー、スマホは本体と同じ下のバー 5 項目（入りきらない 3 つは「その他」にまとめる）。
 */
export type AdminMenuKey = "dashboard" | "reports" | "users" | "hidden" | "announcements" | "legal" | "actions";

export interface AdminMenuItem {
  key: AdminMenuKey;
  label: string;
  /** スマホの下のバー用の短い名前（無ければ label） */
  shortLabel?: string;
  href: string;
  /** 赤い丸で出す件数の種類（未対応の通報／確認待ちの非公開） */
  badge?: "reports" | "hidden";
}

/** パソコンの左メニュー（wireframes「共通の枠」の 7 項目。上から順） */
export const ADMIN_MENU_ITEMS: readonly AdminMenuItem[] = [
  { key: "dashboard", label: "ダッシュボード", href: "/admin" },
  { key: "reports", label: "通報一覧・対応", shortLabel: "通報", href: "/admin/reports", badge: "reports" },
  { key: "users", label: "利用者", href: "/admin/users" },
  { key: "hidden", label: "非公開のもの", href: "/admin/hidden", badge: "hidden" },
  { key: "announcements", label: "お知らせ管理", shortLabel: "お知らせ", href: "/admin/announcements" },
  { key: "legal", label: "規約管理", href: "/admin/legal" },
  { key: "actions", label: "操作の記録", href: "/admin/actions" },
] as const;

/** スマホの下のバーに出す 4 項目。5 つ目は「その他」（/admin/more） */
export const ADMIN_MOBILE_KEYS: readonly AdminMenuKey[] = ["dashboard", "reports", "users", "announcements"] as const;

/** 「その他」の中に入る項目（下のバーに入りきらないもの） */
export const ADMIN_MORE_KEYS: readonly AdminMenuKey[] = ["hidden", "legal", "actions"] as const;

export const ADMIN_MORE_HREF = "/admin/more";

/** メニューに出す件数（0 は出さない） */
export interface AdminBadgeCounts {
  reports: number;
  hidden: number;
}

export function adminMenuItem(key: AdminMenuKey): AdminMenuItem {
  const item = ADMIN_MENU_ITEMS.find((candidate) => candidate.key === key);
  if (!item) throw new Error(`unknown admin menu key: ${key}`);
  return item;
}

/**
 * 選択中の判定。ダッシュボード（/admin）は完全一致だけ（他の項目はすべて /admin/ で始まるため）。
 * スマホの「その他」は、その中の 3 項目のどれかを開いているときも選択中にする。
 */
export function isAdminMenuItemActive(item: AdminMenuItem, pathname: string): boolean {
  if (item.key === "dashboard") return pathname === "/admin";
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function isAdminMoreActive(pathname: string): boolean {
  if (pathname === ADMIN_MORE_HREF) return true;
  return ADMIN_MORE_KEYS.some((key) => isAdminMenuItemActive(adminMenuItem(key), pathname));
}

/** 上のバーに出す画面名。メニューの項目名をそのまま使い、詳細画面だけ言い換える */
export function adminPageTitle(pathname: string): string {
  if (pathname === ADMIN_MORE_HREF) return "その他";
  if (/^\/admin\/reports\/[^/]+$/.test(pathname)) return "通報の詳細";
  if (/^\/admin\/users\/[^/]+$/.test(pathname)) return "利用者の詳細";
  const item = ADMIN_MENU_ITEMS.find((candidate) => isAdminMenuItemActive(candidate, pathname));
  return item?.label ?? "管理画面";
}

/** 件数の表示文字（利用者向けの UnreadBadge と同じ 99+ 止まり） */
export function formatBadgeCount(count: number): string | null {
  if (count <= 0) return null;
  return count > 99 ? "99+" : String(count);
}
