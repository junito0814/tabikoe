/**
 * F-AD-01 Task2: ログイン成功後の遷移先
 * 出典: docs/tasks/admin/admin-login/02-post-login-redirect.md
 *       要件定義書3.10.1（管理者ログイン成功後は管理者ダッシュボード SC-16 に着地）
 *
 * SC-15（管理者ログイン画面）は SC-01 と同じ画面を `admin=1` 付きで開いたもの（4.1「ログイン導線自体は
 * 一般ログインと共通」）。その導線から来て is_admin なら /admin へ。一般導線（SC-01）から来た場合は
 * is_admin の値にかかわらず既存の遷移（redirect_to）を変えない。
 */
export const ADMIN_DASHBOARD_PATH = "/admin";

export function resolvePostLoginRedirect(input: {
  fromAdminLogin: boolean;
  isAdmin: boolean;
  redirectTo: string;
}): string {
  if (input.fromAdminLogin && input.isAdmin) {
    return ADMIN_DASHBOARD_PATH;
  }
  return input.redirectTo;
}
