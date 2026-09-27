/**
 * user-management Task 1: 有効なストライクを丸 5 つで表す（一覧・詳細・SC-28 で共通）
 * 出典: docs/tasks/admin/user-management/01-user-list.md、docs/wireframes.md「SC-24」「SC-28」
 */
export function StrikeDots({ active, max = 5 }: { active: number; max?: number }) {
  return (
    <span aria-label={`有効なストライク ${active}/${max}`} className="inline-flex items-center gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <span key={i} aria-hidden className={`inline-block h-2.5 w-2.5 rounded-full ${i < active ? "bg-saved" : "border border-line bg-surface"}`} />
      ))}
    </span>
  );
}
