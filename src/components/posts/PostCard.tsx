import Link from "next/link";
import { LikeButton } from "@/components/likes/LikeButton";
import type { PostCardData } from "@/lib/posts/post-cards";

/**
 * F-MP-03 Task2・Task3: 投稿カード
 * 出典: docs/tasks/map-search/pin-interaction/02-post-list-ui.md
 *       docs/tasks/map-search/pin-interaction/03-post-detail-navigation.md
 *
 * カード本体が投稿詳細（SC-05、/posts/[id]）へのリンク。いいねボタン（F-VW-02 Task3）は
 * リンクの外（フッター）に置く（リンク内にボタンを入れ子にしない）。
 * 検索結果（F-MP-04）ではスポット名も出す（`showSpotName`）。
 *
 * 【初心者向け】state を持たない表示専用の部品。表示に必要な値は `PostCardData`（lib/posts/post-cards.ts）に
 * サーバー側で整形済みなので、ここでは並べるだけ。v3.0 ではスポット名を見出しにした縦一列のカードに作り替える（post-timeline）。
 */
export function formatCost(cost: number | null): string | null {
  if (cost === null) return null;
  return cost === 0 ? "無料" : `¥${cost.toLocaleString("ja-JP")}`;
}

export function PostCard({ post, showSpotName = false }: { post: PostCardData; showSpotName?: boolean }) {
  return (
    <article className="rounded-[12px] border border-line bg-surface shadow-card">
    <Link
      href={`/posts/${post.id}`}
      className="flex gap-3 p-2.5"
      data-post-card={post.id}
    >
      <span className="relative block h-24 w-24 shrink-0 overflow-hidden rounded-[8px] bg-line">
        {post.thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.thumbnailUrl}
            alt={`${post.spotName}の${post.thumbnailMediaType === "video" ? "動画" : "写真"}`}
            className="h-full w-full object-cover"
          />
        )}
        {post.thumbnailMediaType === "video" && (
          <span className="absolute inset-0 flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 40 40" aria-hidden>
              <circle cx="20" cy="20" r="18" fill="rgba(0,0,0,0.45)" />
              <path d="M16 13l12 7-12 7z" fill="#fff" />
            </svg>
          </span>
        )}
        {post.mediaCount > 1 && (
          <span className="absolute bottom-1 right-1 rounded-full bg-black/55 px-1.5 text-[10px] font-semibold text-white">
            {post.mediaCount}
          </span>
        )}
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-1">
        {showSpotName && (
          <span className="truncate text-[13px] font-semibold text-ink">{post.spotName}</span>
        )}
        <span className="flex items-center gap-1.5 text-[11px] text-muted">
          <span className="rounded-full bg-tint px-2 py-0.5 text-accent">{post.category}</span>
          {post.rating !== null && (
            <span aria-label={`星${post.rating}`}>
              {"★".repeat(post.rating)}
              <span className="text-line">{"★".repeat(5 - post.rating)}</span>
            </span>
          )}
        </span>
        {post.commentExcerpt && (
          <span className="line-clamp-2 text-[12px] leading-[1.6] text-ink">{post.commentExcerpt}</span>
        )}
        <span className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted">
          {post.duration && <span>{post.duration}</span>}
          {formatCost(post.cost) && <span>{formatCost(post.cost)}</span>}
          <span aria-label={`コメント${post.commentCount}件`}>💬 {post.commentCount}</span>
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.author.avatarUrl} alt="" className="h-4 w-4 rounded-full object-cover" />
          <span className="truncate">{post.author.displayName}</span>
          <span>・{new Date(post.createdAt).toLocaleDateString("ja-JP")}</span>
        </span>
      </span>
    </Link>
    <div className="flex items-center justify-end border-t border-line px-2.5 py-1.5">
      <LikeButton postId={post.id} initialLiked={post.viewerHasLiked} initialCount={post.likeCount} className="h-8" />
    </div>
    </article>
  );
}
