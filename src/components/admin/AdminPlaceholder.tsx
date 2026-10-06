/**
 * admin-shell-dashboard Task 1: まだ作っていない管理画面の仮ページ
 * 出典: docs/tasks/admin/admin-shell-dashboard/01-admin-shell.md
 *
 * 【初心者向け】メニューは 7 項目そろえるが、画面はタスクごとに順に作る（利用者 #551、非公開 #555、規約 #560、
 * 記録 #550）。リンク先が 404 だと壊れて見えるので、それまでは「準備中」と、どの Issue で作るかを出しておく。
 */
export function AdminPlaceholder({ issue, description }: { issue: number; description: string }) {
  return (
    <div className="flex w-full flex-col gap-2 rounded-[12px] border border-dashed border-line bg-surface p-6 text-[0.8125rem] text-muted">
      <p className="text-[0.9375rem] font-bold text-ink">準備中</p>
      <p>{description}</p>
      <p>この画面は Issue #{issue} で作ります。</p>
    </div>
  );
}
