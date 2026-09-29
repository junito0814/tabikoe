import { describe, expect, it } from "vitest";
import {
  ADMIN_MENU_ITEMS,
  ADMIN_MOBILE_KEYS,
  ADMIN_MORE_KEYS,
  adminMenuItem,
  adminPageTitle,
  formatBadgeCount,
  isAdminMenuItemActive,
  isAdminMoreActive,
} from "./admin-menu-config";

/** 出典: docs/tasks/admin/admin-shell-dashboard/01-admin-shell.md 単体テスト */
describe("admin-menu-config", () => {
  it("パソコンは 7 項目、スマホは 4 項目＋その他 3 項目で全部を網羅する", () => {
    expect(ADMIN_MENU_ITEMS).toHaveLength(7);
    expect([...ADMIN_MOBILE_KEYS, ...ADMIN_MORE_KEYS].sort()).toEqual(ADMIN_MENU_ITEMS.map((i) => i.key).sort());
  });

  it("ダッシュボードは /admin だけが選択中になる", () => {
    const dashboard = adminMenuItem("dashboard");
    expect(isAdminMenuItemActive(dashboard, "/admin")).toBe(true);
    expect(isAdminMenuItemActive(dashboard, "/admin/reports")).toBe(false);
  });

  it("通報は詳細（/admin/reports/xxx）でも選択中になる", () => {
    expect(isAdminMenuItemActive(adminMenuItem("reports"), "/admin/reports/abc")).toBe(true);
    expect(isAdminMenuItemActive(adminMenuItem("users"), "/admin/reports/abc")).toBe(false);
  });

  it("その他は、その中の項目を開いているときも選択中", () => {
    expect(isAdminMoreActive("/admin/more")).toBe(true);
    expect(isAdminMoreActive("/admin/legal")).toBe(true);
    expect(isAdminMoreActive("/admin/reports")).toBe(false);
  });

  it("画面名は項目名を使い、詳細だけ言い換える", () => {
    expect(adminPageTitle("/admin")).toBe("ダッシュボード");
    expect(adminPageTitle("/admin/reports")).toBe("通報一覧・対応");
    expect(adminPageTitle("/admin/reports/abc")).toBe("通報の詳細");
    expect(adminPageTitle("/admin/users/abc")).toBe("利用者の詳細");
    expect(adminPageTitle("/admin/more")).toBe("その他");
  });

  it("件数は 0 で出さず、99 を超えると 99+", () => {
    expect(formatBadgeCount(0)).toBeNull();
    expect(formatBadgeCount(3)).toBe("3");
    expect(formatBadgeCount(120)).toBe("99+");
  });
});
