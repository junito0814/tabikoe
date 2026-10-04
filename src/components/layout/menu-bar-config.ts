/**
 * menu-bar-v3 Task1: 項目定義と表示判定（ホーム・しおり・通知・マイページ）
 * 出典: docs/tasks/shared-ui/menu-bar-v3/01-menu-config-and-visibility.md
 *       要件定義書 v3.0 4.2
 *
 * 【初心者向け】メニューの「中身」だけをここに置き、描画は AppMenuBar.tsx が担当する。
 * こうしておくと、項目の変更はこのファイルだけで済み、判定関数は DOM 無しで単体テストできる。
 * v3.0 で「全体マップ・新規投稿」を外し、「ホーム（検索トップ）・しおり」を入れた。
 * 地図へはホームの「近くのスポットを探す」と投稿カードの「地図で見る」から、投稿へはホームの
 * 「ここを投稿」と各入口（post-entry-points）から入る。
 */
export interface MenuItem {
  key: "home" | "itineraries" | "notifications" | "mypage";
  label: string;
  href: string;
}

export const MENU_ITEMS: readonly MenuItem[] = [
  { key: "home", label: "ホーム", href: "/" },
  // #693: 画面名は「計画」。中の 1 つ 1 つは今までどおり「しおり」（決定事項 75）
  { key: "itineraries", label: "計画", href: "/itineraries" },
  { key: "notifications", label: "通知", href: "/notifications" },
  { key: "mypage", label: "マイページ", href: "/mypage" },
] as const;

/**
 * メニューバーを出さない画面。前方一致で判定するものは末尾に "/" を付けない
 *
 * 【初心者向け】`/terms`・`/privacy` は**未ログインでも開ける「読むだけ」のページ**（同意画面・再同意画面からの
 * リンク先）なので、メニューバーを出す前提がない。出してしまうと、メニューバーが未読件数 API を呼び、
 * 再同意待ち・登録待ちの人には 401 が返ってログイン画面へ飛ばされ、規約が読めなくなる（#583）。
 */
const HIDDEN_EXACT_PATHS = new Set(["/login", "/signup", "/consent/renew", "/terms", "/privacy"]);
const HIDDEN_PREFIXES = ["/admin", "/dev"];

/**
 * 4.2 の除外条件（未ログインのホーム・ログイン・新規作成・管理画面）に加え、開発用プレビュー（/dev）も除外する。
 * ホーム（"/"）はログイン済みのときだけ出す（未ログインの SC-00 はサービス説明とログインボタンだけの画面）。
 */
export function shouldShowMenuBar(pathname: string, isAuthenticated = true): boolean {
  if (pathname === "/") {
    return isAuthenticated;
  }
  if (HIDDEN_EXACT_PATHS.has(pathname)) {
    return false;
  }
  return !HIDDEN_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/** 現在地の判定。ホームは検索トップ（/）と検索結果（/search）を同じ系統として扱う */
export function isMenuItemActive(item: MenuItem, pathname: string): boolean {
  if (item.key === "home") {
    return pathname === "/" || pathname === "/search" || pathname.startsWith("/search/");
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
