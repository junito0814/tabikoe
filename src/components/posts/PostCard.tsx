"use client";

import Link from "next/link";
import { LikeButton } from "@/components/likes/LikeButton";
import { MediaGrid } from "@/components/media/MediaGrid";
import { SaveButton } from "@/components/save/SaveButton";
import type { PostCardData } from "@/lib/posts/post-cards";
import { buildMapHrefWithBack } from "@/lib/search/list-state";
import { formatStatusLabel } from "@/lib/spots/format-status-label";

/**
 * post-timeline Task2（v3.0）: 投稿カード（縦一列のタイムライン用）
 * 出典: docs/tasks/map-search/post-timeline/02-timeline-ui.md
 *       docs/tasks/browsing/spot-status-report/03-embed-latest-status.md
 *       要件定義書 v3.0 3.4.2（受入条件 45）
 *
 * 【初心者向け】カードの上から順に:
 *   1. 投稿者・訪問日・「徒歩 N 分」（現在地があるときだけ。`post.walkMinutes`）
 *   2. 見出し＝スポット名（手動登録スポットなら「タビコエだけの場所」）。タップでスポット別一覧へ
 *   3. 感想の冒頭 2 行（`line-clamp-2`）。タップで投稿詳細へ
 *   4. 星評価（黄＋「星4」）・予算（¥1,200/人）・カテゴリ
 *   5. 写真・動画（MediaGrid。5 点目以降は「+N」）
 *   6. 「9月にまだあった」（最新の報告があるときだけ）
 *   7. いいね・コメント件数・「地図で見る」・「＋」
 * state を持たない表示専用の部品。表示に必要な値は `PostCardData`（lib/posts/post-cards.ts）に整形済み。
 * 「地図で見る」は地図（SC-02）をそのスポット中心で開き、`back` に今の一覧 URL を持たせて「一覧に戻る」を可能にする。
 */
export function formatCost(cost: number | null): string | null {
  if (cost === null) return null;
  return cost === 0 ? "無料" : `¥${cost.toLocaleString("ja-JP")}`;
}

/** 「訪問 9/3」用。visit_date（YYYY-MM-DD）→ M/D */
export function formatVisitDate(visitDate: string | null): string | null {
  if (!visitDate) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(visitDate);
  if (!match) return null;
  return `${Number(match[2])}/${Number(match[3])}`;
}

export function PostCard({
  post,
  backHref = null,
  showSpotName = true,
  onSavePress,
}: {
  post: PostCardData;
  /** 「地図で見る」から戻ってくるための今の一覧 URL（/search?…） */
  backHref?: string | null;
  /** スポット別一覧では見出しにスポット名があるので省略できる */
  showSpotName?: boolean;
  /** 追加モード中: 「＋」でしおりに直接追加する（add-spots Task2） */
  onSavePress?: (post: PostCardData) => void;
}) {
  const visit = formatVisitDate(post.visitDate);
  const cost = formatCost(post.cost);
  const statusLabel = formatStatusLabel(post.latestStatus);
  const mapHref = buildMapHrefWithBack({ spot: post.spotId, lat: post.spotLat, lng: post.spotLng }, backHref);

  return (
    <article className="flex flex-col gap-2 rounded-[12px] border border-line bg-surface p-3 shadow-card" data-post-card={post.id}>
      <div className="flex items-center gap-1.5 text-[11px] text-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={post.author.avatarUrl} alt="" className="h-5 w-5 rounded-full object-cover" />
        <span className="min-w-0 truncate font-medium text-ink">{post.author.displayName}</span>
        <span className="ml-auto flex shrink-0 items-center gap-1">
          {visit && <span>訪問 {visit}</span>}
          {visit && post.walkMinutes !== null && <span aria-hidden>・</span>}
          {post.walkMinutes !== null && <span data-walk-minutes>徒歩 {post.walkMinutes}分</span>}
        </span>
      </div>

      {showSpotName && (
        <h3 className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[15px] font-bold leading-tight text-ink">
          <Link href={`/search?spot=${post.spotId}`} className="min-w-0 truncate">
            {post.spotName}
          </Link>
          {post.isManualSpot && (
            <span className="rounded-full bg-tint px-2 py-0.5 text-[10px] font-semibold text-accent">タビコエだけの場所</span>
          )}
        </h3>
      )}

      <Link href={`/posts/${post.id}`} className="flex flex-col gap-1.5">
        {post.commentExcerpt && <p className="line-clamp-2 text-[13px] leading-[1.6] text-ink">{post.commentExcerpt}</p>}
        <p className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[12px] text-muted">
          {post.rating !== null && (
            <span className="flex items-center gap-1" aria-label={`星${post.rating}`}>
              <span className="text-[13px] text-star" aria-hidden>
                {"★".repeat(post.rating)}
                <span className="text-line">{"★".repeat(5 - post.rating)}</span>
              </span>
              <span>星{post.rating}</span>
            </span>
          )}
          {cost && <span>{cost === "無料" ? cost : `${cost}/人`}</span>}
          <span className="rounded-full bg-tint px-2 py-0.5 text-[11px] text-accent">{post.category}</span>
          {post.duration && <span>{post.duration}</span>}
        </p>
      </Link>

      {post.media.length > 0 && <MediaGrid items={post.media} postHref={`/posts/${post.id}`} />}

      {statusLabel && (
        <p className="text-[12px] font-medium text-done" data-spot-status>
          {statusLabel}
        </p>
      )}

      <div className="flex items-center gap-2 border-t border-line pt-2">
        <LikeButton postId={post.id} initialLiked={post.viewerHasLiked} initialCount={post.likeCount} className="h-8" />
        <Link
          href={`/posts/${post.id}#comments`}
          aria-label={`コメント${post.commentCount}件`}
          className="inline-flex h-8 items-center gap-1 rounded-full px-2 text-[12px] text-muted"
        >
          <span aria-hidden>💬</span>
          {post.commentCount}
        </Link>
        <Link
          href={mapHref}
          className="ml-auto inline-flex h-8 items-center gap-1 rounded-full border border-line bg-surface px-3 text-[12px] font-semibold text-ink"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M12 21s-6-5.2-6-10a6 6 0 1 1 12 0c0 4.8-6 10-6 10z" stroke="currentColor" strokeWidth="1.8" />
            <circle cx="12" cy="11" r="2.2" fill="currentColor" />
          </svg>
          地図で見る
        </Link>
        <SaveButton spotId={post.spotId} initialSaved={post.viewerHasSaved} size="sm" onPress={onSavePress ? () => onSavePress(post) : undefined} />
      </div>
    </article>
  );
}
