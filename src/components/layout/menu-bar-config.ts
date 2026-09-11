/**
 * 共通メニューバー Task1: 項目定義と表示判定
 * 出典: docs/tasks/shared-ui/menu-bar/01-menu-bar-component.md
 *       要件定義書4.2（4項目。トップページ・ログイン画面・アカウント新規作成画面・管理画面を除く）
 *
 * 遷移先のうち /map（SC-02, Phase 5）・/notifications（SC-14, Phase 9）・/mypage（SC-06, Phase 7）は
 * まだ画面が無い。パスはここで確定させ、各画面の実装時にこの定義を変えずに済むようにする。
 */
export interface MenuItem {
  key: "map" | "post" | "notifications" | "mypage";
  label: string;
  href: string;
}

export const MENU_ITEMS: readonly MenuItem[] = [
  { key: "map", label: "全体マップ", href: "/map" },
  { key: "post", label: "新規投稿", href: "/posts/new" },
  { key: "notifications", label: "通知", href: "/notifications" },
  { key: "mypage", label: "マイページ", href: "/mypage" },
] as const;

/** メニューバーを出さない画面。前方一致で判定するものは末尾に "/" を付けない */
const HIDDEN_EXACT_PATHS = new Set(["/", "/login", "/signup"]);
const HIDDEN_PREFIXES = ["/admin", "/dev"];

/**
 * 4.2の除外条件に加え、開発用プレビュー（/dev）も除外する。
 * 管理画面（SC-15〜18）は /admin 配下で、一般ユーザーには存在自体を見せない（3.10.1）。
 */
export function shouldShowMenuBar(pathname: string): boolean {
  if (HIDDEN_EXACT_PATHS.has(pathname)) {
    return false;
  }
  return !HIDDEN_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/** 現在地の判定。/posts/new と /posts/xxx/edit はどちらも「新規投稿」の系統として扱う */
export function isMenuItemActive(item: MenuItem, pathname: string): boolean {
  if (item.key === "post") {
    return pathname.startsWith("/posts");
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
