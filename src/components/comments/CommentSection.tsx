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
import { Sheet } from "@/components/ui/Sheet";
import { useKeyboardInset } from "@/lib/ui/use-keyboard-inset";

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
  /*
   * #874（2026-10-07）: コメントは「コメント N 件」を押すと**下から出るシート**で読み書きする。
   *
   * 【初心者向け】以前は投稿詳細の本文の下にそのまま並べていたので、
   *   - 読むには**いちばん下まで送る**必要があった（投稿が 1 件のスポットでは届かないこともあった。#867）
   *   - 書くにも同じだけ送る必要があった
   * Instagram と同じように、どこからでもボタン 1 つで開くようにします。
   * 閉じ方（取っ手・Android の戻るキー）はアプリの他のシートと同じです（#796・#804）。
   */
  const [isOpen, setIsOpen] = useState(false);
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
  // #803: キーボードが出ている間は、その高さぶん入力欄を持ち上げる
  const keyboardInset = useKeyboardInset();
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

  const form = canComment ? (
        /*
          * #803（2026-10-06）: 入力欄を**画面の下に固定**した。
          *
          * 【初心者向け】以前は一覧の**上**にあったので、読んでから書こうとすると
          * 上まで戻る必要がありました。LINE・Instagram はどれも下に固定です（読んでから書く）。
          * キーボードが出たときは、その高さぶん持ち上げます（`use-keyboard-inset`）。
          * メニューバーがある画面では、その上（60px）に置きます。
          */
        <form
          onSubmit={handleSubmit}
          /*
            * #803: 入力欄は読むところより**下**（読んでから書く）。
            * #874: シートの footer に入れたので、画面に貼り付ける（fixed）必要が無くなった。
            * キーボードが出たときは、その高さぶん下に余白を足して押し上げる（`use-keyboard-inset`）。
            */
          style={keyboardInset > 0 ? { paddingBottom: keyboardInset } : undefined}
          data-comment-form
          className="flex flex-col gap-1.5"
        >
          {replyTo && (
            <div className="flex items-center gap-2 text-[0.75rem]" data-reply-to={replyTo.id}>
              <span className="inline-flex items-center gap-1 rounded-full bg-tint px-2 py-0.5 font-semibold text-accent">
                @{replyTo.name}
                <button type="button" onClick={() => setReplyTo(null)} aria-label="返信をやめる" className="ml-0.5 text-muted">
                  ×
                </button>
              </span>
              <span className="text-muted">への返信</span>
            </div>
          )}
          {/*
            * #772（2026-10-06）: 残りの文字数は**打ち始めてから**出す。
            * 以前は空のときから「残り4,000文字（4,000文字まで）」と**同じ数字が 2 回**出ていた。
            */}
          {draft.length > 0 && (
            <span className={`text-[0.6875rem] ${remaining < 0 ? "text-accent" : "text-muted"}`} aria-live="polite" data-remaining>
              残り {remaining.toLocaleString("ja-JP")} 文字
            </span>
          )}
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={1}
              placeholder={replyTo ? "返信を書く" : "コメントを書く"}
              aria-label="コメント本文"
              className="max-h-28 min-h-11 w-full flex-1 resize-none rounded-[18px] border border-line bg-surface px-3 py-2.5 text-[0.875rem] text-ink focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <button
              type="submit"
              disabled={!canSubmit}
              aria-label={replyTo ? "返信する" : "コメントする"}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-white disabled:cursor-not-allowed disabled:opacity-45"
            >
              {isSubmitting ? (
                <span className="text-[0.625rem] font-semibold">送信中</span>
              ) : (
                /* 紙飛行機（送る） */
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M4 12 20 4l-8 16-2-6-6-2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          </div>
        </form>
  ) : (
    <p className="text-[0.75rem] text-muted">非公開の投稿にはコメントできません</p>
  );

  const list = (
    <>
      {errorMessage && <ErrorNotice message={errorMessage} />}

      {comments.length === 0 ? (
        <p className="py-6 text-center text-[0.75rem] text-muted">まだコメントはありません</p>
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
                          className="text-[0.75rem] font-semibold text-accent"
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
          className="h-10 w-full rounded-[10px] border border-line bg-surface text-[0.8125rem] font-semibold text-ink disabled:opacity-45"
        >
          {isLoadingMore ? "読み込み中…" : "もっと見る"}
        </button>
      )}
    </>
  );

  return (
    <>
      {confirmSheet}
      {/*
        * #874: 本文の下に並べるのをやめ、ここは「コメント N 件」の入口だけにする。
        * 押すと下からシートで開く（Instagram と同じ）。
        */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        data-open-comments
        className="tap-target flex w-fit items-center gap-1.5 rounded-full border border-line bg-surface px-4 text-[0.8125rem] font-semibold text-ink"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M20 12a8 8 0 1 1-3.1-6.3M20 5v4h-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0" />
          <path d="M4 5h16v11H9l-5 4V5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
        {/* 文字そのものは flex の隙間が効かないので、span に入れて離す */}
        <span>コメント</span>
        <span className="font-medium text-muted">{totalCount} 件</span>
      </button>

      <Sheet open={isOpen} title="コメント" onClose={() => setIsOpen(false)} footer={form}>
        {list}
      </Sheet>
    </>
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
      <p className="text-[0.75rem] text-muted" data-deleted-comment>
        削除されたコメント
      </p>
    );
  }
  return (
    <>
      <div className="mb-1 flex items-center gap-2 text-[0.6875rem] text-muted">
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
            <button type="button" onClick={onReply} className="tap-target text-[0.6875rem] font-medium text-ink underline underline-offset-2" data-reply-button>
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
            <ReportLink targetType="comment" targetId={comment.id} returnTo={returnTo} className="text-[0.6875rem]" />
          )}
        </span>
      </div>
      {comment.parentId && comment.replyToName && (
        <p className="mb-0.5 text-[0.6875rem] font-medium text-accent" data-reply-to-name>
          @{comment.replyToName} への返信
        </p>
      )}
      <p className="whitespace-pre-wrap break-words text-[0.8125rem] leading-[1.7] text-ink">{comment.body}</p>
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
