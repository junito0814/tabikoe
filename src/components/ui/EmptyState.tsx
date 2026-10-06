import Link from "next/link";

/**
 * #800（2026-10-06）: 空の画面に「次の一手」を 1 つ置く
 * 出典: Issue #800「空の画面（行きたい・投稿履歴）に次の操作のボタンを 1 つ置く」
 *
 * 【初心者向け】行きたい・投稿履歴の空の画面は**文だけ**で、押せるものがありませんでした。
 * 「まだありません」と言われても、**どうすれば貯まるのか**が画面の中にありません。
 * 計画・アルバムには「＋ 新規」があるので、そこだけ親切だったことになります。
 *
 * 見出し・補足・ボタン 1 つ。4 画面で同じ形にします（約束 14）。
 */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  /** 次の一手。無い画面（下書きなど）は省く */
  action?: { label: string; href: string };
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center" data-empty-state>
      <p className="text-[0.875rem] font-bold text-ink">{title}</p>
      {/* #774: 最後の 1 文字だけが次の行に落ちないよう、行の長さをそろえる */}
      {description && <p className="max-w-[300px] text-[0.75rem] leading-[1.8] text-balance text-muted">{description}</p>}
      {action && (
        /* #784: 指で押す的は 32px 以上。ここは主役の一手なので 44px（h-11） */
        <Link href={action.href} className="mt-1 flex h-11 items-center rounded-full bg-accent px-5 text-[0.875rem] font-bold text-white">
          {action.label}
        </Link>
      )}
    </div>
  );
}
