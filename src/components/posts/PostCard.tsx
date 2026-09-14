import Link from "next/link";
import type { PostCardData } from "@/lib/posts/post-cards";

/**
 * F-MP-03 Task2・Task3: 投稿カード
 * 出典: docs/tasks/map-search/pin-interaction/02-post-list-ui.md
 *       docs/tasks/map-search/pin-interaction/03-post-detail-navigation.md
 *
 * カード全体が投稿詳細（SC-05、/posts/[id]）へのリンク。
 * 検索結果（F-MP-04）ではスポット名も出す（`showSpotName`）。
 */
export function formatCost(cost: number | null): string | null {
  if (cost === null) return null;
  return cost === 0 ? "無料" : `¥${cost.toLocaleString("ja-JP")}`;
}

export function PostCard({ post, showSpotName = false }: { post: PostCardData; showSpotName?: boolean }) {
  return (
    <Link
      href={`/posts/${post.id}`}
      className="flex gap-3 rounded-[12px] border border-[#E8E1D8] bg-white p-2.5 shadow-[0_2px_16px_rgba(61,58,53,0.04)]"
      data-post-card={post.id}
    >
      <span className="relative block h-24 w-24 shrink-0 overflow-hidden rounded-[8px] bg-[#E8E1D8]">
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
          <span className="truncate text-[13px] font-semibold text-[#3D3A35]">{post.spotName}</span>
        )}
        <span className="flex items-center gap-1.5 text-[11px] text-[#9C9488]">
          <span className="rounded-full bg-[#FBF6F0] px-2 py-0.5 text-[#C4703F]">{post.category}</span>
          {post.rating !== null && (
            <span aria-label={`星${post.rating}`}>
              {"★".repeat(post.rating)}
              <span className="text-[#E8E1D8]">{"★".repeat(5 - post.rating)}</span>
            </span>
          )}
        </span>
        {post.commentExcerpt && (
          <span className="line-clamp-2 text-[12px] leading-[1.6] text-[#3D3A35]">{post.commentExcerpt}</span>
        )}
        <span className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[#9C9488]">
          {post.duration && <span>{post.duration}</span>}
          {formatCost(post.cost) && <span>{formatCost(post.cost)}</span>}
          <span aria-label={`いいね${post.likeCount}件`}>♥ {post.likeCount}</span>
          <span aria-label={`コメント${post.commentCount}件`}>💬 {post.commentCount}</span>
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-[#9C9488]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.author.avatarUrl} alt="" className="h-4 w-4 rounded-full object-cover" />
          <span className="truncate">{post.author.displayName}</span>
          <span>・{new Date(post.createdAt).toLocaleDateString("ja-JP")}</span>
        </span>
      </span>
    </Link>
  );
}
