import { createAdminClient } from "@/lib/supabase/admin";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { HiddenItemsScreen } from "@/components/admin/HiddenItemsScreen";
import { listHiddenItems, parseHiddenTab, type HiddenTab } from "@/lib/admin/hidden-items";

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
 * user-management Task 3: 非公開にしたもの（SC-25）
 * 出典: docs/tasks/admin/user-management/03-hidden-items.md
 *
 * タブは URL（?tab=auto|admin|suspension）。自動のタブの件数は投稿＋コメントの hidden_reason = 'auto' を数える
 */
export default async function AdminHiddenPage({ searchParams }: PageProps<"/admin/hidden">) {
  const params = await searchParams;
  const tab = parseHiddenTab(typeof params.tab === "string" ? params.tab : null);
  const admin = createAdminClient();
  let loaded: { page: Awaited<ReturnType<typeof listHiddenItems>>; counts: Partial<Record<HiddenTab, number>> } | null = null;
  try {
    const counting = (table: string, reason: string) => admin.from(table).select("id", { count: "exact", head: true }).eq("hidden_reason", reason);
    const [page, autoPosts, autoComments, suspPosts] = await Promise.all([
      listHiddenItems(admin, tab, 0),
      counting("posts", "auto"),
      counting("comments", "auto"),
      counting("posts", "suspension"),
    ]);
    loaded = { page, counts: { auto: (autoPosts.count ?? 0) + (autoComments.count ?? 0), suspension: suspPosts.count ?? 0 } };
  } catch {
    loaded = null;
  }
  if (!loaded) {
    return <ErrorNotice message={ERROR_MESSAGES.dbLoadFailure} retryable className="w-full" />;
  }
  return <HiddenItemsScreen tab={tab} counts={loaded.counts} initialPage={loaded.page} />;
}
