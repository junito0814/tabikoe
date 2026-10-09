"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { ReportLink } from "@/components/reports/ReportLink";
import { TrashButton } from "@/components/ui/TrashButton";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import { MAX_COMMENT_LENGTH } from "@/lib/comments/constants";
import type { CommentData, CommentPage } from "@/lib/comments/list-comments";
import { DEFAULT_AVATAR_URL } from "@/lib/users/constants";
import { graphemeLength } from "@/lib/text/grapheme-length";
import { commentExcerpt } from "@/lib/comments/comment-excerpt";
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
  open,
  onOpenChange,
  onSummaryChange,
}: {
  postId: string;
  /**
   * 1 ページ目。**null なら「まだ読んでいない」** で、シートを開いたときに取りに行く（#885）。
   *
   * 【初心者向け】一覧の画面では投稿カードが 20 枚並ぶ。全部のコメントを先に読むと
   * 20 回の問い合わせになり、しかもほとんどは開かれない。開いたときだけ読む。
   */
  initialPage: CommentPage | null;
  canComment: boolean;
  /** 通報画面からの戻り先 */
  returnTo: string;
  /** 差し替え口（単体テスト用） */
  api?: CommentApi;
  /**
   * #885: 外から開け閉めする（カードの「コメント」を押して開くとき）。
   * 渡さなければ、今までどおり自分の「コメント N 件」ボタンを出して自分で開け閉めする。
   */
  open?: boolean;
  onOpenChange?: (next: boolean) => void;
  /** #885: シートを閉じたときに、件数と最新のコメントを呼び出し元へ返す（カードの表示を更新するため） */
  onSummaryChange?: (summary: { count: number; latest: { authorName: string; excerpt: string } | null }) => void;
}) {
  const [comments, setComments] = useState<CommentData[]>(initialPage?.comments ?? []);
  const [nextOffset, setNextOffset] = useState<number | null>(initialPage?.nextOffset ?? null);
  const [totalCount, setTotalCount] = useState(initialPage?.totalCount ?? 0);
  const [viewerAvatarUrl, setViewerAvatarUrl] = useState<string | null>(initialPage?.viewerAvatarUrl ?? null);
  /** #885: まだ 1 ページ目を読んでいないか（initialPage が null で渡されたとき） */
  const [isLoadingFirstPage, setIsLoadingFirstPage] = useState(false);
  const loadedRef = useRef(initialPage !== null);
  /*
   * #874（2026-10-07）: コメントは「コメント N 件」を押すと**下から出るシート**で読み書きする。
   *
   * 【初心者向け】以前は投稿詳細の本文の下にそのまま並べていたので、
   *   - 読むには**いちばん下まで送る**必要があった（投稿が 1 件のスポットでは届かないこともあった。#867）
   *   - 書くにも同じだけ送る必要があった
   * Instagram と同じように、どこからでもボタン 1 つで開くようにします。
   * 閉じ方（取っ手・Android の戻るキー）はアプリの他のシートと同じです（#796・#804）。
   */
  /*
   * #885: 開け閉めは「外から渡されたらそれに従い、渡されなければ自分で持つ」。
   * 投稿詳細は自分で持ち（今までどおり）、一覧のカードは外から開ける。
   */
  const [ownOpen, setOwnOpen] = useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : ownOpen;
  const setIsOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setOwnOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange]
  );
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

  /*
   * #885: 開いたときに 1 ページ目を取る（`initialPage` が null で渡されたとき＝一覧のカードから開いたとき）。
   * 一度読んだら二度は読まない（`loadedRef`）。失敗しても開いたままにし、中に断りを出す。
   */
  useEffect(() => {
    if (!isOpen || loadedRef.current || isLoadingFirstPage) return;
    loadedRef.current = true;
    setIsLoadingFirstPage(true);
    void (async () => {
      try {
        const page = await api.fetchPage(postId, 0);
        setComments(page.comments);
        setNextOffset(page.nextOffset);
        setTotalCount(page.totalCount);
        setViewerAvatarUrl(page.viewerAvatarUrl);
      } catch (error) {
        if (error instanceof UnauthorizedError) return;
        loadedRef.current = false; // 次に開いたらもう一度試す
        setErrorMessage(ERROR_MESSAGES.dbLoadFailure);
      } finally {
        setIsLoadingFirstPage(false);
      }
    })();
  }, [isOpen, isLoadingFirstPage, api, postId]);

  /*
   * #885: 閉じたときに、件数と最新のコメントを呼び出し元へ返す。
   *
   * 【初心者向け】一覧のカードは「コメント 2 件」と最新の 1 件を出している。シートで書いたのに
   * 閉じたらカードが古いままだと辻褄が合わない。最新の 1 件は**返信も含めていちばん新しいもの**で、
   * 抜き出し方はサーバーと同じ `commentExcerpt` を使う（約束 14: 同じものを 2 か所に書かない）。
   */
  const wasOpenRef = useRef(isOpen);
  useEffect(() => {
    const justClosed = wasOpenRef.current && !isOpen;
    wasOpenRef.current = isOpen;
    if (!justClosed || !onSummaryChange) return;
    const all = comments.flatMap((comment) => (comment.deleted ? comment.replies : [comment, ...comment.replies]));
    const newest = all.reduce<CommentData | null>((best, one) => (best === null || one.createdAt > best.createdAt ? one : best), null);
    onSummaryChange({
      count: totalCount,
      latest: newest ? { authorName: newest.author.displayName, excerpt: commentExcerpt(newest.body) } : null,
    });
  }, [isOpen, comments, totalCount, onSummaryChange]);

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
            /* #885: 入力欄のすぐ上に、枠つきで「@名前 への返信」。× でやめる */
            <div
              className="flex items-center justify-between gap-2 rounded-[8px] border border-accent px-2 py-1 text-[0.6875rem] font-medium text-accent"
              data-reply-to={replyTo.id}
            >
              <span>@{replyTo.name} への返信</span>
              <button type="button" onClick={() => setReplyTo(null)} aria-label="返信をやめる" className="tap-target text-accent">
                ×
              </button>
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
            {/* #885: 誰として書くかが分かるよう、入力欄の左に自分のアイコンを出す */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={viewerAvatarUrl ?? DEFAULT_AVATAR_URL} alt="" className="mb-1 h-6 w-6 shrink-0 rounded-full object-cover" />
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
              /* #885: 1 件ごとの「返信する」と名前がぶつかるので、送信側は「返信を送る」にする（読み上げで区別が付かなくなるため） */
              aria-label={replyTo ? "返信を送る" : "コメントする"}
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

      {isLoadingFirstPage ? (
        <p className="py-6 text-center text-[0.75rem] text-muted">読み込み中…</p>
      ) : comments.length === 0 ? (
        <p className="py-6 text-center text-[0.75rem] text-muted">まだコメントはありません</p>
      ) : (
        /* #885: 枠と左の罫線をやめた。返信は親の本文の下に入れ子で置き、アイコンのぶんだけ字下げされる */
        <ul className="flex flex-col gap-3">
          {comments.map((comment) => {
            const expanded = expandedRoots.has(comment.id);
            const visibleReplies = expanded ? comment.replies : comment.replies.slice(0, REPLIES_PREVIEW_COUNT);
            const hiddenCount = comment.replies.length - visibleReplies.length;
            return (
              <li key={comment.id} data-comment={comment.id}>
                <CommentItem
                  comment={comment}
                  canReply={canComment}
                  pendingDeleteId={pendingDeleteId}
                  returnTo={returnTo}
                  onDelete={handleDelete}
                  onReply={() => setReplyTo({ id: comment.id, rootId: comment.id, name: comment.author.displayName })}
                >
                  {comment.replies.length > 0 && (
                    <ul className="mt-2 flex flex-col gap-2" data-replies={comment.id}>
                      {visibleReplies.map((reply) => (
                        <li key={reply.id} data-comment={reply.id}>
                          <CommentItem
                            comment={reply}
                            canReply={canComment}
                            pendingDeleteId={pendingDeleteId}
                            returnTo={returnTo}
                            onDelete={handleDelete}
                            onReply={() => setReplyTo({ id: reply.id, rootId: comment.id, name: reply.author.displayName })}
                            small
                          />
                        </li>
                      ))}
                      {hiddenCount > 0 && (
                        <li>
                          <button
                            type="button"
                            onClick={() => setExpandedRoots((current) => new Set(current).add(comment.id))}
                            className="text-[0.6875rem] font-semibold text-muted"
                          >
                            返信をさらに {hiddenCount} 件見る
                          </button>
                        </li>
                      )}
                    </ul>
                  )}
                </CommentItem>
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
        * #885: 外から開け閉めするとき（一覧のカード）は、入口を呼び出し元が持つのでここには出さない。
        */}
      {!isControlled && (
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
      )}

      <Sheet open={isOpen} title="コメント" onClose={() => setIsOpen(false)} footer={form}>
        {list}
      </Sheet>
    </>
  );
}

/**
 * 1 件分（最上位でも返信でも同じ）。返信なら本文の先頭に「@名前」。
 *
 * #885（2026-10-09）: **枠をやめ、丸いアイコンの列と本文の列の 2 列**にした（要件 3.5.3）。
 *
 * 【初心者向け】それまでは 1 件ずつ枠で囲み、上に「アイコン・名前・日時」の行、下に本文、
 * という 2 段でした。枠と余白で 1 件が縦に大きく、同じ高さに 2〜3 件しか入りません。
 * Instagram は枠を使わず、**アイコンの列が 1 件の区切り**になっています。
 *   - アイコンは 24px（返信は 19px）。名前の添え物ではなく、**誰が書いたか**が先に目に入る
 *   - **名前と本文が同じ行から続く**（「**みさき** 昼前が空いてるよ」）
 *   - 日時と「返信する」は**本文のすぐ下**に小さく（右端に離さない）
 *   - 1 件ごとの区切り線は引かない
 */
function CommentItem({
  comment,
  canReply,
  pendingDeleteId,
  returnTo,
  onDelete,
  onReply,
  small = false,
  children,
}: {
  comment: CommentData;
  canReply: boolean;
  pendingDeleteId: string | null;
  returnTo: string;
  onDelete: (commentId: string) => void;
  onReply: () => void;
  /** 返信（アイコンを一回り小さくする） */
  small?: boolean;
  /** この本文の下に字下げして入るもの（返信の列） */
  children?: ReactNode;
}) {
  if (comment.deleted) {
    return (
      <div className="flex items-start gap-2">
        <span aria-hidden className={`${small ? "h-[19px] w-[19px]" : "h-6 w-6"} shrink-0 rounded-full bg-tint`} />
        <div className="min-w-0 flex-1">
          <p className="text-[0.75rem] text-muted" data-deleted-comment>
            削除されたコメント
          </p>
          {children}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={comment.author.avatarUrl} alt="" className={`${small ? "h-[19px] w-[19px]" : "h-6 w-6"} shrink-0 rounded-full object-cover`} />
      <div className="min-w-0 flex-1">
        {/* 名前と本文を同じ行から続ける。本文は改行を活かすが、名前の直後から始まる */}
        <p className="whitespace-pre-wrap break-words text-[0.8125rem] leading-[1.6] text-ink">
          {comment.author.isDeleted ? (
            <span className="font-bold">{comment.author.displayName}</span>
          ) : (
            <Link href={`/users/${comment.author.id}`} className="font-bold text-ink">
              {comment.author.displayName}
            </Link>
          )}{" "}
          {comment.parentId && comment.replyToName && (
            <span className="font-semibold text-accent" data-reply-to-name>
              @{comment.replyToName}{" "}
            </span>
          )}
          {comment.body}
        </p>
        <div className="mt-0.5 flex items-center gap-3 text-[0.625rem] text-muted">
          <span>{formatDateTime(comment.createdAt)}</span>
          {canReply && (
            <button type="button" onClick={onReply} className="tap-target font-medium text-muted" data-reply-button>
              返信する
            </button>
          )}
          {comment.isMine ? (
            <TrashButton
              onClick={() => onDelete(comment.id)}
              label="このコメントを削除"
              disabled={pendingDeleteId !== null}
              busy={pendingDeleteId === comment.id}
              className="h-6 w-6"
            />
          ) : (
            <ReportLink targetType="comment" targetId={comment.id} returnTo={returnTo} className="text-[0.625rem]" />
          )}
        </div>
        {children}
      </div>
    </div>
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
