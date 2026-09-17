"use client";

import { useState } from "react";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";

/**
 * F-VW-02 Task3: いいねボタン（投稿カード・投稿詳細で共用）
 * 出典: docs/tasks/browsing/likes/03-like-button-ui.md
 *
 * いいね済み／未いいねを塗りつぶしと aria-pressed で区別する。楽観的に切り替え、失敗時は戻す。
 * 非公開投稿にはいいねできない（3.3.6）ため、呼び出し側は公開投稿でのみ描画する。
 */
export function LikeButton({
  postId,
  initialLiked,
  initialCount,
  submitToggle = defaultSubmitToggle,
  className,
}: {
  postId: string;
  initialLiked: boolean;
  initialCount: number;
  /** 差し替え口（単体テスト用） */
  submitToggle?: (postId: string, like: boolean) => Promise<Response>;
  className?: string;
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [isPending, setIsPending] = useState(false);

  const handleClick = async () => {
    if (isPending) return;
    const next = !liked;
    setIsPending(true);
    setLiked(next);
    setCount((current) => Math.max(0, current + (next ? 1 : -1)));

    try {
      const response = await submitToggle(postId, next);
      if (!response.ok) {
        setLiked(!next);
        setCount((current) => Math.max(0, current + (next ? -1 : 1)));
        return;
      }
      const data = (await response.json()) as { liked: boolean; likeCount?: number };
      setLiked(data.liked);
      if (typeof data.likeCount === "number") setCount(data.likeCount);
    } catch (error) {
      setLiked(!next);
      setCount((current) => Math.max(0, current + (next ? -1 : 1)));
      if (error instanceof UnauthorizedError) return;
    } finally {
      setIsPending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-pressed={liked}
      aria-label={liked ? "いいねを取り消す" : "いいねする"}
      className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[12px] font-semibold transition-colors disabled:opacity-60 ${
        liked ? "border-accent bg-accent text-white" : "border-line bg-surface text-ink"
      } ${className ?? ""}`}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 21s-7.5-4.6-9.5-9A5 5 0 0 1 12 6a5 5 0 0 1 9.5 6c-2 4.4-9.5 9-9.5 9z"
          fill={liked ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
      <span data-like-count>{count}</span>
    </button>
  );
}

function defaultSubmitToggle(postId: string, like: boolean): Promise<Response> {
  return fetchWithAuthRedirect(`/api/posts/${postId}/like`, { method: like ? "POST" : "DELETE" });
}
