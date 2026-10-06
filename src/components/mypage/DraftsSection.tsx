"use client";

import { useState } from "react";
import Link from "next/link";
import { PencilIcon } from "@/components/ui/LineIcons";
import { TrashButton } from "@/components/ui/TrashButton";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import { composeHref } from "@/lib/posts/compose-href";
import type { DraftListPage, DraftSummary } from "@/lib/posts/drafts";
import { useConfirm } from "@/components/ui/ConfirmSheet";
import { formatDateTime } from "@/lib/format/date-time";

/**
 * my-page-v3 Task1: マイページの「下書き」の段
 * 出典: docs/tasks/records/my-page-v3/01-drafts-section-and-menu.md
 *       要件定義書 v3.0 3.3.7・3.6.1（受入条件 51）
 *
 * 【初心者向け】下書きがあるときだけ先頭に出す。「下書き N 件」と最新 3 件（スポット名・保存日時・サムネイル）。4 件以上なら「すべて見る」で /mypage/drafts へ（v3.1）。
 * 「続きを書く」→ /posts/new?draft=<id>（SC-03 が保存時の状態で開く）。「削除」は確認してから DELETE /api/posts/[id]。
 * 下書きは他人には一切見えない（地図のピン・一覧・検索に出ない）。
 */
export const DRAFTS_PREVIEW_COUNT = 3;

export function DraftsSection({
  initial,
  submitDelete = defaultSubmitDelete,
  showAll = false,
}: {
  initial: DraftListPage;
  submitDelete?: (id: string) => Promise<Response>;
  /** true なら件数を絞らず全件出す（/mypage/drafts の下書き一覧。v3.1） */
  showAll?: boolean;
}) {
  const [drafts, setDrafts] = useState<DraftSummary[]>(initial.drafts);
  const [total, setTotal] = useState(initial.total);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // #778: 確認はブラウザ標準の箱ではなく、アプリ共通のシートで聞く
  const { confirm, confirmSheet } = useConfirm();

  if (total === 0) return null;

  const remove = async (draft: DraftSummary) => {
    if (pendingId) return;
    if (!(await confirm({ title: `下書き「${draft.spotName}」を削除しますか？`, confirmLabel: "削除", danger: true }))) return;
    setPendingId(draft.id);
    setError(null);
    try {
      const response = await submitDelete(draft.id);
      if (!response.ok) {
        setError("下書きを削除できませんでした");
        return;
      }
      setDrafts((current) => current.filter((item) => item.id !== draft.id));
      setTotal((current) => Math.max(0, current - 1));
    } catch (caught) {
      if (caught instanceof UnauthorizedError) return;
      setError("下書きを削除できませんでした");
    } finally {
      setPendingId(null);
    }
  };

  return (
    <section aria-label="下書き" data-drafts-section className="flex flex-col gap-2 rounded-[12px] border border-dashed border-line bg-surface p-3">
      {confirmSheet}
      <h2 className="flex items-center gap-1.5 text-[0.8125rem] font-bold text-ink">
        <PencilIcon size={12} />
        下書き {total} 件
      </h2>
      <ul className="flex flex-col gap-1.5">
        {(showAll ? drafts : drafts.slice(0, DRAFTS_PREVIEW_COUNT)).map((draft) => (
          <li key={draft.id} className="flex items-center gap-2" data-draft={draft.id}>
            <span className="block h-10 w-10 shrink-0 overflow-hidden rounded-[6px] border border-dashed border-line bg-app">
              {draft.thumbnailUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={draft.thumbnailUrl} alt="" className="h-full w-full object-cover" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.8125rem] font-semibold text-ink">
                <span className="mr-1 text-muted" aria-hidden>
                  ◌
                </span>
                {draft.spotName}
              </span>
              <span className="block text-[0.6875rem] text-muted">{formatDateTime(draft.updatedAt)}</span>
            </span>
            <Link href={composeHref({ kind: "draft", draftId: draft.id })} className="shrink-0 rounded-full bg-accent px-3 py-1.5 text-[0.6875rem] font-bold text-white">
              続きを書く
            </Link>
            <TrashButton
              onClick={() => void remove(draft)}
              label={`下書き「${draft.spotName}」を削除`}
              disabled={pendingId !== null}
              busy={pendingId === draft.id}
              className="h-7 w-7"
            />
          </li>
        ))}
      </ul>
      {/* v3.1（mentoring-7 Task1）: 4 件以上あるときだけ「すべて見る」→ /mypage/drafts（下書き一覧） */}
      {!showAll && total > DRAFTS_PREVIEW_COUNT && (
        <Link href="/mypage/drafts" className="self-end text-[0.75rem] font-medium text-accent underline underline-offset-2">
          すべて見る（{total} 件）
        </Link>
      )}
      {error && (
        <p role="alert" className="text-[0.75rem] text-saved">
          {error}
        </p>
      )}
    </section>
  );
}

function defaultSubmitDelete(id: string): Promise<Response> {
  return fetchWithAuthRedirect(`/api/posts/${id}`, { method: "DELETE" });
}
