"use client";

import { useCallback, useState, type FormEvent } from "react";
import Link from "next/link";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { ReportLink } from "@/components/reports/ReportLink";
import { TrashButton } from "@/components/ui/TrashButton";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import { MAX_COMMENT_LENGTH } from "@/lib/comments/constants";
import type { CommentData, CommentPage } from "@/lib/comments/list-comments";
import { graphemeLength } from "@/lib/text/grapheme-length";
import { POSTING_RESTRICTED_ERROR, postingRestrictedMessage } from "@/lib/moderation/posting-restriction";
import { useConfirm } from "@/components/ui/ConfirmSheet";
import { formatDateTime } from "@/lib/format/date-time";

export interface CommentApi {
  fetchPage: (postId: string, offset: number) => Promise<CommentPage>;
  /** v3.2: parentId を渡すと返信になる */
  submit: (postId: string, body: string, parentId?: string | null) => Promise<Response>;
  remove: (commentId: string) => Promise<Response>;
}

/** v3.2: 返信が何件を超えたら折りたたむか */
export const REPLIES_PREVIEW_COUNT = 3;

/**
 * F-VW-03 Task6: コメント欄（投稿詳細画面に組み込み）
 * 出典: docs/tasks/browsing/comments/06-comment-ui.md
 *
 * 入力フォーム（4,000文字の残数表示）、一覧（新着順・20件）、「もっと見る」、削除ボタン（自分のコメントのみ）。
 * 非公開投稿にはコメントできない（3.3.6）ため、`canComment=false` ではフォームを出さない。
 *
 * 【初心者向け】投稿・削除のあとは一覧を取り直さず、手元の state を直接書き換える（体感が速い）。
 * そのぶん `totalCount` と `nextOffset`（次に読む位置）も自分でずらす必要がある点に注意。
 * v3.2（feedback-0919 Task4）: 返信。各コメントの「返信」を押すと入力欄に「@名前」のチップが付いて返信モードになる（× で解除）。
 * 返信は親の下に 1 段だけ字下げして古い順に並べ（返信への返信も同じ段）、先頭に「@名前 への返信」。
 * 3 件を超えたら「返信をさらに N 件見る」で開く。返信がある親を削除すると「削除されたコメント」の枠が残る。
 */
export function CommentSection({
  postId,
  initialPage,
  canComment,
  returnTo,
  api = defaultApi,
}: {
  postId: string;
  initialPage: CommentPage;
  canComment: boolean;
  /** 通報画面からの戻り先 */
  returnTo: string;
  /** 差し替え口（単体テスト用） */
  api?: CommentApi;
}) {
  const [comments, setComments] = useState<CommentData[]>(initialPage.comments);
  const [nextOffset, setNextOffset] = useState<number | null>(initialPage.nextOffset);
  const [totalCount, setTotalCount] = useState(initialPage.totalCount);
  const [draft, setDraft] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  // #778: 確認はブラウザ標準の箱ではなく、アプリ共通のシートで聞く
  const { confirm, confirmSheet } = useConfirm();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  /** v3.2: 返信モード（返信先のコメントと、そのやり取りの最上位コメント） */
  const [replyTo, setReplyTo] = useState<{ id: string; rootId: string; name: string } | null>(null);
  /** v3.2: 返信を全部開いた親コメントの ID */
  const [expandedRoots, setExpandedRoots] = useState<Set<string>>(new Set());

  const remaining = MAX_COMMENT_LENGTH - graphemeLength(draft);
  const canSubmit = draft.trim().length > 0 && remaining >= 0 && !isSubmitting;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const response = await api.submit(postId, draft, replyTo?.id ?? null);
      if (response.status === 429) {
        setErrorMessage("コメントの投稿が多すぎます。1分ほど待ってから再度お試しください");
        return;
      }
      if (response.status === 403) {
        // strike-system Task 2: 投稿・コメント禁止中
        const data = (await response.json().catch(() => ({}))) as { error?: string; until?: string };
        setErrorMessage(data.error === POSTING_RESTRICTED_ERROR && data.until ? postingRestrictedMessage(data.until) : "コメントを投稿できませんでした");
        return;
      }
      if (!response.ok) {
        setErrorMessage("コメントを投稿できませんでした");
        return;
      }
      const data = (await response.json()) as { comment: CommentData };
      if (replyTo) {
        // 返信: そのやり取りの末尾に足す（最上位の件数は変わらないので nextOffset はそのまま）
        const rootId = replyTo.rootId;
        setComments((current) => current.map((comment) => (comment.id === rootId ? { ...comment, replies: [...comment.replies, data.comment] } : comment)));
        setExpandedRoots((current) => new Set(current).add(rootId));
        setReplyTo(null);
      } else {
        setComments((current) => [data.comment, ...current]);
        // 新着順の先頭に足したので、以降の追加読み込み位置を1つずらす
        setNextOffset((current) => (current === null ? null : current + 1));
      }
      setTotalCount((current) => current + 1);
      setDraft("");
    } catch (error) {
      if (error instanceof UnauthorizedError) return;
      setErrorMessage("コメントを投稿できませんでした");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore || nextOffset === null) return;
    setIsLoadingMore(true);
    setErrorMessage(null);
    try {
      const page = await api.fetchPage(postId, nextOffset);
      setComments((current) => {
        const seen = new Set(current.map((comment) => comment.id));
        return [...current, ...page.comments.filter((comment) => !seen.has(comment.id))];
      });
      setNextOffset(page.nextOffset);
      setTotalCount(page.totalCount);
    } catch (error) {
      if (error instanceof UnauthorizedError) return;
      setErrorMessage(ERROR_MESSAGES.dbLoadFailure);
    } finally {
      setIsLoadingMore(false);
    }
  }, [api, isLoadingMore, nextOffset, postId]);

  const handleDelete = async (commentId: string) => {
    if (pendingDeleteId) return;
    if (!(await confirm({ title: "このコメントを削除しますか？", confirmLabel: "削除", danger: true }))) return;
    setPendingDeleteId(commentId);
    setErrorMessage(null);
    try {
      const response = await api.remove(commentId);
      if (!response.ok) {
        setErrorMessage("コメントを削除できませんでした");
        return;
      }
      const data = (await response.json().catch(() => ({}))) as { keptFrame?: boolean };
      setComments((current) =>
        current.flatMap((comment) => {
          if (comment.id === commentId) {
            // v3.2: 返信がある親は「削除されたコメント」の枠を残す
            if (data.keptFrame || comment.replies.length > 0) {
              return [{ ...comment, deleted: true, body: "", isMine: false, author: { id: "", displayName: "削除されたコメント", avatarUrl: comment.author.avatarUrl, isDeleted: true } }];
            }
            return [];
          }
          const replies = comment.replies.filter((reply) => reply.id !== commentId);
          // 枠だけ残っていた親の返信が 0 になったら、親も消える（サーバーと同じ）
          if (replies.length === 0 && comment.deleted) return [];
          return [{ ...comment, replies }];
        })
      );
      setTotalCount((current) => Math.max(0, current - 1));
      if (comments.some((comment) => comment.id === commentId && comment.replies.length === 0)) {
        setNextOffset((current) => (current === null ? null : Math.max(0, current - 1)));
      }
    } catch (error) {
      if (error instanceof UnauthorizedError) return;
      setErrorMessage("コメントを削除できませんでした");
    } finally {
      setPendingDeleteId(null);
    }
  };

  return (
    <section aria-labelledby="comments-heading" className="flex flex-col gap-3">
      {confirmSheet}
      <h2 id="comments-heading" className="text-[14px] font-bold text-ink">
        コメント <span className="text-[12px] font-medium text-muted">{totalCount}件</span>
      </h2>

      {canComment ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          {replyTo && (
            <div className="flex items-center gap-2 text-[12px]" data-reply-to={replyTo.id}>
              <span className="inline-flex items-center gap-1 rounded-full bg-tint px-2 py-0.5 font-semibold text-accent">
                @{replyTo.name}
                <button type="button" onClick={() => setReplyTo(null)} aria-label="返信をやめる" className="ml-0.5 text-muted">
                  ×
                </button>
              </span>
              <span className="text-muted">への返信</span>
            </div>
          )}
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={3}
            placeholder={replyTo ? "返信を書く" : "コメントを書く"}
            aria-label="コメント本文"
            className="w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-[14px] text-ink focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <div className="flex items-center justify-between">
            <span
              className={`text-[11px] ${remaining < 0 ? "text-accent" : "text-muted"}`}
              aria-live="polite"
            >
              残り{remaining.toLocaleString("ja-JP")}文字（{MAX_COMMENT_LENGTH.toLocaleString("ja-JP")}文字まで）
            </span>
            <button
              type="submit"
              disabled={!canSubmit}
              className="h-9 rounded-[8px] bg-accent px-4 text-[12px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
            >
              {isSubmitting ? "投稿中…" : replyTo ? "返信する" : "コメントする"}
            </button>
          </div>
        </form>
      ) : (
        <p className="text-[12px] text-muted">非公開の投稿にはコメントできません</p>
      )}

      {errorMessage && <ErrorNotice message={errorMessage} />}

      {comments.length === 0 ? (
        <p className="py-6 text-center text-[12px] text-muted">まだコメントはありません</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {comments.map((comment) => {
            const expanded = expandedRoots.has(comment.id);
            const visibleReplies = expanded ? comment.replies : comment.replies.slice(0, REPLIES_PREVIEW_COUNT);
            const hiddenCount = comment.replies.length - visibleReplies.length;
            return (
              <li key={comment.id} className="rounded-[10px] border border-line bg-surface p-3" data-comment={comment.id}>
                <CommentItem
                  comment={comment}
                  canReply={canComment}
                  pendingDeleteId={pendingDeleteId}
                  returnTo={returnTo}
                  onDelete={handleDelete}
                  onReply={() => setReplyTo({ id: comment.id, rootId: comment.id, name: comment.author.displayName })}
                />
                {comment.replies.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-2 border-l-2 border-line pl-3" data-replies={comment.id}>
                    {visibleReplies.map((reply) => (
                      <li key={reply.id} data-comment={reply.id}>
                        <CommentItem
                          comment={reply}
                          canReply={canComment}
                          pendingDeleteId={pendingDeleteId}
                          returnTo={returnTo}
                          onDelete={handleDelete}
                          onReply={() => setReplyTo({ id: reply.id, rootId: comment.id, name: reply.author.displayName })}
                        />
                      </li>
                    ))}
                    {hiddenCount > 0 && (
                      <li>
                        <button
                          type="button"
                          onClick={() => setExpandedRoots((current) => new Set(current).add(comment.id))}
                          className="text-[12px] font-semibold text-accent"
                        >
                          返信をさらに {hiddenCount} 件見る
                        </button>
                      </li>
                    )}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {nextOffset !== null && (
        <button
          type="button"
          onClick={() => void handleLoadMore()}
          disabled={isLoadingMore}
          className="h-10 w-full rounded-[10px] border border-line bg-surface text-[13px] font-semibold text-ink disabled:opacity-45"
        >
          {isLoadingMore ? "読み込み中…" : "もっと見る"}
        </button>
      )}
    </section>
  );
}

/** 1 件分（最上位でも返信でも同じ）。返信なら先頭に「@名前 への返信」。削除済みの枠は本文の代わりに案内だけ */
function CommentItem({
  comment,
  canReply,
  pendingDeleteId,
  returnTo,
  onDelete,
  onReply,
}: {
  comment: CommentData;
  canReply: boolean;
  pendingDeleteId: string | null;
  returnTo: string;
  onDelete: (commentId: string) => void;
  onReply: () => void;
}) {
  if (comment.deleted) {
    return (
      <p className="text-[12px] text-muted" data-deleted-comment>
        削除されたコメント
      </p>
    );
  }
  return (
    <>
      <div className="mb-1 flex items-center gap-2 text-[11px] text-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={comment.author.avatarUrl} alt="" className="h-5 w-5 rounded-full object-cover" />
        {comment.author.isDeleted ? (
          <span>{comment.author.displayName}</span>
        ) : (
          <Link href={`/users/${comment.author.id}`} className="font-medium text-ink">
            {comment.author.displayName}
          </Link>
        )}
        <span>・{formatDateTime(comment.createdAt)}</span>
        <span className="ml-auto flex items-center gap-3">
          {canReply && (
            <button type="button" onClick={onReply} className="text-[11px] font-medium text-ink underline underline-offset-2" data-reply-button>
              返信
            </button>
          )}
          {comment.isMine ? (
            <TrashButton
              onClick={() => onDelete(comment.id)}
              label="このコメントを削除"
              disabled={pendingDeleteId !== null}
              busy={pendingDeleteId === comment.id}
              className="h-7 w-7"
            />
          ) : (
            <ReportLink targetType="comment" targetId={comment.id} returnTo={returnTo} className="text-[11px]" />
          )}
        </span>
      </div>
      {comment.parentId && comment.replyToName && (
        <p className="mb-0.5 text-[11px] font-medium text-accent" data-reply-to-name>
          @{comment.replyToName} への返信
        </p>
      )}
      <p className="whitespace-pre-wrap break-words text-[13px] leading-[1.7] text-ink">{comment.body}</p>
    </>
  );
}

const defaultApi: CommentApi = {
  fetchPage: async (postId, offset) => {
    const response = await fetchWithAuthRedirect(`/api/posts/${postId}/comments?offset=${offset}`);
    if (!response.ok) throw new Error(`Failed to fetch comments: ${response.status}`);
    return (await response.json()) as CommentPage;
  },
  submit: (postId, body, parentId = null) =>
    fetchWithAuthRedirect(`/api/posts/${postId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parentId ? { body, parentId } : { body }),
    }),
  remove: (commentId) => fetchWithAuthRedirect(`/api/comments/${commentId}`, { method: "DELETE" }),
};
