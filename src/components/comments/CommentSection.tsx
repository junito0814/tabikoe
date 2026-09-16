"use client";

import { useCallback, useState, type FormEvent } from "react";
import Link from "next/link";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { ReportLink } from "@/components/reports/ReportLink";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import { MAX_COMMENT_LENGTH } from "@/lib/comments/constants";
import type { CommentData, CommentPage } from "@/lib/comments/list-comments";
import { graphemeLength } from "@/lib/text/grapheme-length";

export interface CommentApi {
  fetchPage: (postId: string, offset: number) => Promise<CommentPage>;
  submit: (postId: string, body: string) => Promise<Response>;
  remove: (commentId: string) => Promise<Response>;
}

/**
 * F-VW-03 Task6: コメント欄（投稿詳細画面に組み込み）
 * 出典: docs/tasks/browsing/comments/06-comment-ui.md
 *
 * 入力フォーム（4,000文字の残数表示）、一覧（新着順・20件）、「もっと見る」、削除ボタン（自分のコメントのみ）。
 * 非公開投稿にはコメントできない（3.3.6）ため、`canComment=false` ではフォームを出さない。
 *
 * 【初心者向け】投稿・削除のあとは一覧を取り直さず、手元の state を直接書き換える（体感が速い）。
 * そのぶん `totalCount` と `nextOffset`（次に読む位置）も自分でずらす必要がある点に注意。
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const remaining = MAX_COMMENT_LENGTH - graphemeLength(draft);
  const canSubmit = draft.trim().length > 0 && remaining >= 0 && !isSubmitting;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const response = await api.submit(postId, draft);
      if (response.status === 429) {
        setErrorMessage("コメントの投稿が多すぎます。1分ほど待ってから再度お試しください");
        return;
      }
      if (!response.ok) {
        setErrorMessage("コメントを投稿できませんでした");
        return;
      }
      const data = (await response.json()) as { comment: CommentData };
      setComments((current) => [data.comment, ...current]);
      setTotalCount((current) => current + 1);
      // 新着順の先頭に足したので、以降の追加読み込み位置を1つずらす
      setNextOffset((current) => (current === null ? null : current + 1));
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
    if (!window.confirm("このコメントを削除しますか？")) return;
    setPendingDeleteId(commentId);
    setErrorMessage(null);
    try {
      const response = await api.remove(commentId);
      if (!response.ok) {
        setErrorMessage("コメントを削除できませんでした");
        return;
      }
      setComments((current) => current.filter((comment) => comment.id !== commentId));
      setTotalCount((current) => Math.max(0, current - 1));
      setNextOffset((current) => (current === null ? null : Math.max(0, current - 1)));
    } catch (error) {
      if (error instanceof UnauthorizedError) return;
      setErrorMessage("コメントを削除できませんでした");
    } finally {
      setPendingDeleteId(null);
    }
  };

  return (
    <section aria-labelledby="comments-heading" className="flex flex-col gap-3">
      <h2 id="comments-heading" className="text-[14px] font-bold text-[#3D3A35]">
        コメント <span className="text-[12px] font-medium text-[#9C9488]">{totalCount}件</span>
      </h2>

      {canComment ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={3}
            placeholder="コメントを書く"
            aria-label="コメント本文"
            className="w-full rounded-[10px] border border-[#E8E1D8] bg-white px-3 py-2 text-[14px] text-[#3D3A35] focus:outline-none focus:ring-1 focus:ring-[#C4703F]"
          />
          <div className="flex items-center justify-between">
            <span
              className={`text-[11px] ${remaining < 0 ? "text-[#C4703F]" : "text-[#9C9488]"}`}
              aria-live="polite"
            >
              残り{remaining.toLocaleString("ja-JP")}文字（{MAX_COMMENT_LENGTH.toLocaleString("ja-JP")}文字まで）
            </span>
            <button
              type="submit"
              disabled={!canSubmit}
              className="h-9 rounded-[8px] bg-[#C4703F] px-4 text-[12px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
            >
              {isSubmitting ? "投稿中…" : "コメントする"}
            </button>
          </div>
        </form>
      ) : (
        <p className="text-[12px] text-[#9C9488]">非公開の投稿にはコメントできません</p>
      )}

      {errorMessage && <ErrorNotice message={errorMessage} />}

      {comments.length === 0 ? (
        <p className="py-6 text-center text-[12px] text-[#9C9488]">まだコメントはありません</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {comments.map((comment) => (
            <li key={comment.id} className="rounded-[10px] border border-[#E8E1D8] bg-white p-3" data-comment={comment.id}>
              <div className="mb-1 flex items-center gap-2 text-[11px] text-[#9C9488]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={comment.author.avatarUrl} alt="" className="h-5 w-5 rounded-full object-cover" />
                {comment.author.isDeleted ? (
                  <span>{comment.author.displayName}</span>
                ) : (
                  <Link href={`/users/${comment.author.id}`} className="font-medium text-[#3D3A35]">
                    {comment.author.displayName}
                  </Link>
                )}
                <span>・{new Date(comment.createdAt).toLocaleString("ja-JP")}</span>
                <span className="ml-auto flex items-center gap-3">
                  {comment.isMine ? (
                    <button
                      type="button"
                      onClick={() => handleDelete(comment.id)}
                      disabled={pendingDeleteId !== null}
                      aria-label="このコメントを削除"
                      className="text-[11px] font-medium text-[#C4703F] underline underline-offset-2 disabled:opacity-45"
                    >
                      {pendingDeleteId === comment.id ? "削除中…" : "削除"}
                    </button>
                  ) : (
                    <ReportLink targetType="comment" targetId={comment.id} returnTo={returnTo} className="text-[11px]" />
                  )}
                </span>
              </div>
              <p className="whitespace-pre-wrap break-words text-[13px] leading-[1.7] text-[#3D3A35]">{comment.body}</p>
            </li>
          ))}
        </ul>
      )}

      {nextOffset !== null && (
        <button
          type="button"
          onClick={() => void handleLoadMore()}
          disabled={isLoadingMore}
          className="h-10 w-full rounded-[10px] border border-[#E8E1D8] bg-white text-[13px] font-semibold text-[#3D3A35] disabled:opacity-45"
        >
          {isLoadingMore ? "読み込み中…" : "もっと見る"}
        </button>
      )}
    </section>
  );
}

const defaultApi: CommentApi = {
  fetchPage: async (postId, offset) => {
    const response = await fetchWithAuthRedirect(`/api/posts/${postId}/comments?offset=${offset}`);
    if (!response.ok) throw new Error(`Failed to fetch comments: ${response.status}`);
    return (await response.json()) as CommentPage;
  },
  submit: (postId, body) =>
    fetchWithAuthRedirect(`/api/posts/${postId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    }),
  remove: (commentId) => fetchWithAuthRedirect(`/api/comments/${commentId}`, { method: "DELETE" }),
};
