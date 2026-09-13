import Link from "next/link";

/**
 * F-AD-02 Task1: 管理者ダッシュボード画面（SC-16）
 * 出典: docs/tasks/admin/admin-dashboard/01-dashboard-ui.md
 *
 * アクセス制御はsrc/proxy.ts（is_admin判定・404）に委ね、本ページは画面表示のみを扱う。
 * 遷移先: /admin/announcements（SC-17、F-AD-03）・/admin/reports（SC-18、F-AD-04/05）。
 */
export default function AdminDashboardPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#FBF6F0] px-6">
      <h1 className="mb-2 text-[18px] font-bold text-[#3D3A35]">管理者ダッシュボード</h1>
      <div className="flex w-full max-w-[360px] flex-col gap-3">
        <Link
          href="/admin/announcements"
          className="flex h-14 items-center justify-center rounded-[10px] border border-[#E8E1D8] bg-white text-[15px] font-semibold text-[#3D3A35] shadow-[0_2px_16px_rgba(61,58,53,0.1)]"
        >
          お知らせ管理
        </Link>
        <Link
          href="/admin/reports"
          className="flex h-14 items-center justify-center rounded-[10px] border border-[#E8E1D8] bg-white text-[15px] font-semibold text-[#3D3A35] shadow-[0_2px_16px_rgba(61,58,53,0.1)]"
        >
          通報一覧・対応
        </Link>
      </div>
    </div>
  );
}
