import Link from "next/link";
import { ADMIN_MORE_KEYS, adminMenuItem } from "@/components/admin/admin-menu-config";

/*
 * #901: 器を静的に作る対象から外す（instant = false）。
 *
 * 【初心者向け】管理画面は**パソコン前提・ログイン必須**で、開くのは運営だけです。
 * 器を先に配ってもうれしい人がいないうえ、ダッシュボードは `new Date()` など
 * **毎回変わるもの**を素で読んでいます。利用者向けの画面を先に進めるため、ここは外します。
 * 外しても動きは今までどおりです（毎回サーバーで描く）。
 */
export const instant = false;

/**
 * admin-shell-dashboard Task 1: スマホの「その他」（下のバーに入りきらない 3 項目＋サイトへ戻る）
 * 出典: docs/tasks/admin/admin-shell-dashboard/01-admin-shell.md
 *       docs/wireframes.md「スマホでの管理画面」
 */
export default function AdminMorePage() {
  return (
    <ul className="flex w-full flex-col overflow-hidden rounded-[12px] border border-line bg-surface">
      {ADMIN_MORE_KEYS.map((key) => {
        const item = adminMenuItem(key);
        return (
          <li key={key} className="border-b border-line last:border-b-0">
            <Link href={item.href} className="flex h-12 items-center px-4 text-[0.875rem] font-medium text-ink">
              {item.label}
            </Link>
          </li>
        );
      })}
      <li className="border-t border-line">
        <Link href="/" className="flex h-12 items-center px-4 text-[0.875rem] text-muted">
          ← サイトへ戻る
        </Link>
      </li>
    </ul>
  );
}
