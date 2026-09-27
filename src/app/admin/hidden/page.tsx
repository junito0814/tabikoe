import { createAdminClient } from "@/lib/supabase/admin";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { HiddenItemsScreen } from "@/components/admin/HiddenItemsScreen";
import { listHiddenItems, parseHiddenTab, type HiddenTab } from "@/lib/admin/hidden-items";

export const dynamic = "force-dynamic";

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
