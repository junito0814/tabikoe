import Link from "next/link";
import { ADMIN_MENU_ITEMS } from "@/components/admin/admin-menu-config";

/**
 * admin-shell-dashboard Task 1: 管理者ダッシュボード（SC-16）の仮の中身
 * 出典: docs/tasks/admin/admin-shell-dashboard/01-admin-shell.md
 *
 * 枠（メニュー）は src/app/admin/layout.tsx が付ける。「対応が要るもの」「数字」「最近の動き」は Task 2（#546）で
 * ここに入る。それまでは各画面への入口をカードで並べておく（前の 2 ボタンと同じ役割）。
 */
export default function AdminDashboardPage() {
  return (
    <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {ADMIN_MENU_ITEMS.filter((item) => item.key !== "dashboard").map((item) => (
        <Link
          key={item.key}
          href={item.href}
          className="flex h-16 items-center justify-center rounded-[10px] border border-line bg-surface text-[14px] font-semibold text-ink shadow-card"
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
