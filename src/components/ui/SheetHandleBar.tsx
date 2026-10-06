/**
 * #804（2026-10-06）: シートの上に出す取っ手の棒（見た目だけ）
 * 出典: Issue #804「シートに取っ手を付け、下に引いて閉じられるようにする」
 *
 * 【初心者向け】`MapSheetLayout` にだけ付いていた棒を、`Sheet` と共通の部品にしました（約束 14）。
 * 棒そのものは細いまま、**掴める範囲は 32px 以上**にします（要件 4.5.6）。
 */
export function SheetHandleBar() {
  return <span className="h-1 w-10 rounded-full bg-line" />;
}
