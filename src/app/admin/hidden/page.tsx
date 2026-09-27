import { AdminPlaceholder } from "@/components/admin/AdminPlaceholder";

/** admin-shell-dashboard Task 1: 仮ページ（本体は #555）。出典: docs/tasks/admin/admin-shell-dashboard/01-admin-shell.md */
export default function Page() {
  return <AdminPlaceholder issue={555} description="自動・管理者・停止で非公開になったものの一覧と復元（SC-25）" />;
}
