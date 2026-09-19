import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUserOrRedirect } from "@/lib/auth/require-user-or-redirect";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { DraftsSection } from "@/components/mypage/DraftsSection";
import { getMyDrafts } from "@/lib/posts/drafts";

/**
 * mentoring-7 Task1（v3.1）: 下書き一覧（SC-06 の「すべて見る」から）
 * 出典: docs/tasks/shared-ui/mentoring-7/01-terminology.md
 *       要件定義書 v3.1 3.6.1（下書きは 3 件＋「すべて見る」）
 *
 * 【初心者向け】マイページの下書きの段は最新 3 件だけ出すので、4 件以上あるときはこのページで全部見る。
 * 中身は同じ DraftsSection を `showAll` で使い回す（続きを書く・削除の動きはマイページと同じ）。
 * 下書きの上限は 20 件（draft Task1）なので、ページングは要らない。
 */
export default async function MyDraftsPage() {
  const supabase = await createClient();
  const user = await requireUserOrRedirect(supabase, "/mypage/drafts");

  const admin = createAdminClient();
  const drafts = await getMyDrafts(admin, user.id).catch(() => null);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[420px] flex-col gap-4 bg-app px-4 pt-4 pb-[calc(60px+env(safe-area-inset-bottom))] md:pb-6">
      <header className="flex items-center gap-2">
        <Link href="/mypage" className="flex h-9 items-center rounded-full border border-line bg-surface px-3 text-[12px] font-semibold text-ink shadow-card">
          ← マイページ
        </Link>
        <h1 className="text-[17px] font-bold text-ink">下書き</h1>
      </header>
      {drafts ? (
        drafts.total === 0 ? (
          <p className="py-12 text-center text-[13px] text-muted">下書きはありません</p>
        ) : (
          <DraftsSection initial={drafts} showAll />
        )
      ) : (
        <ErrorNotice message={ERROR_MESSAGES.dbLoadFailure} retryable />
      )}
    </div>
  );
}
