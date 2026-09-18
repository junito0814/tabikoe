"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MediaGrid } from "@/components/media/MediaGrid";
import { SaveButton } from "@/components/save/SaveButton";
import { LikeButton } from "@/components/likes/LikeButton";
import { CommentSection } from "@/components/comments/CommentSection";
import { ReportLink } from "@/components/reports/ReportLink";
import { DeletePostButton } from "@/components/posts/DeletePostButton";
import { SpotStatusButtons } from "@/components/spots/SpotStatusButtons";
import type { CommentPage } from "@/lib/comments/list-comments";
import type { PostDetailData } from "@/lib/posts/post-detail";
import { composeHref } from "@/lib/posts/compose-href";
import { buildMapHrefWithBack } from "@/lib/search/list-state";
import { formatCost } from "./PostCard";

/**
 * F-VW-01 Task2 / post-detail-view-v3 Task1（v3.0）: 投稿詳細画面（SC-05）
 * 出典: docs/tasks/browsing/post-detail-view/02-post-detail-ui.md
 *       docs/tasks/browsing/post-detail-view-v3/01-heading-and-links.md
 *       要件定義書 v3.0 3.5.1
 *
 * 【初心者向け】上から順に:
 *   1. 戻る・「通報」（他人）・「⋯」（本人: 編集／削除。削除は右端）
 *   2. 見出し＝スポット名（→ スポット別一覧）＋「タビコエだけの場所」、都道府県・カテゴリ、星、訪問日・滞在・費用
 *   3. 写真・動画（MediaGrid。タップで MediaModal）、感想
 *   4. 投稿者・投稿日時
 *   5. 「いいね」「＋」（保存先シート）「地図で見る」、「この場所、まだありますか？」（SpotStatusButtons）、「自分も投稿する」
 *   6. コメント欄
 * 旅行タイトルは表示しない（3.3.4）。非公開投稿ではいいね・コメント欄・まだあったを出さない。
 * `post.isOwner`（本人）・`post.canInteract`（公開投稿）はサーバーで計算して渡される。
 */
export function PostDetailScreen({
  post,
  initialComments,
  notice,
}: {
  post: PostDetailData;
  initialComments: CommentPage;
  /** 投稿・更新の完了メッセージ（Server Component から渡す。v3.0） */
  notice?: React.ReactNode;
}) {
  const returnTo = `/posts/${post.id}`;
  const cost = formatCost(post.cost);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isMenuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setIsMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [isMenuOpen]);

  const mapHref = buildMapHrefWithBack({ spot: post.spot.id, lat: post.spot.lat, lng: post.spot.lng }, null);

  return (
    <div className="flex min-h-screen flex-col items-center bg-app px-4 pt-4 pb-8">
      <article className="flex w-full max-w-[520px] flex-col gap-4">
        {notice}
        <header className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Link href={`/spots/${post.spot.id}`} className="inline-flex h-8 shrink-0 items-center gap-1 text-[12px] font-medium text-muted">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              戻る
            </Link>
            <span className="flex-1" />
            {post.isOwner ? (
              <div ref={menuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setIsMenuOpen((open) => !open)}
                  aria-haspopup="menu"
                  aria-expanded={isMenuOpen}
                  aria-label="その他"
                  className="h-8 w-8 rounded-full border border-line bg-surface text-[14px] font-bold text-ink"
                >
                  ⋯
                </button>
                {isMenuOpen && (
                  <div role="menu" className="absolute right-0 z-20 mt-1 flex min-w-[140px] flex-col overflow-hidden rounded-[10px] border border-line bg-surface py-1 shadow-card">
                    <Link href={`/posts/${post.id}/edit`} role="menuitem" className="px-3 py-2 text-[13px] text-ink hover:bg-tint">
                      編集
                    </Link>
                    <div className="px-3 py-1.5">
                      <DeletePostButton postId={post.id} />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <ReportLink targetType="post" targetId={post.id} returnTo={returnTo} />
            )}
          </div>

          <h1 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[18px] font-bold leading-tight text-ink">
            <Link href={`/spots/${post.spot.id}`} className="min-w-0 break-words">
              {post.spot.name}
            </Link>
            {post.spot.isManualSpot && <span className="rounded-full bg-tint px-2 py-0.5 text-[10px] font-semibold text-accent">タビコエだけの場所</span>}
            {post.visibility === "private" && <span className="rounded-full bg-line px-2 py-0.5 text-[10px] font-semibold text-ink">非公開</span>}
          </h1>
          <p className="flex flex-wrap items-center gap-x-1.5 text-[12px] text-muted">
            <span>{post.spot.prefecture ?? "都道府県未設定"}</span>
            <span aria-hidden>・</span>
            <span className="rounded-full bg-tint px-2 py-0.5 text-accent">{post.category}</span>
          </p>
          <p className="text-[14px]" aria-label={post.rating !== null ? `星${post.rating}` : "未評価"}>
            {post.rating !== null ? (
              <>
                <span className="text-star">{"★".repeat(post.rating)}</span>
                <span className="text-line">{"★".repeat(5 - post.rating)}</span>
                <span className="ml-1.5 text-[12px] text-muted">星{post.rating}</span>
              </>
            ) : (
              <span className="text-[12px] text-muted">未評価</span>
            )}
          </p>
          <dl className="flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-ink">
            <div className="flex gap-1">
              <dt className="text-muted">訪問日</dt>
              <dd>{post.visitDate ? new Date(post.visitDate).toLocaleDateString("ja-JP") : "未入力"}</dd>
            </div>
            <div className="flex gap-1">
              <dt className="text-muted">滞在</dt>
              <dd>{post.duration ?? "未入力"}</dd>
            </div>
            <div className="flex gap-1">
              <dt className="text-muted">費用</dt>
              <dd>{cost ? (cost === "無料" ? cost : `${cost}/人`) : "未入力"}</dd>
            </div>
          </dl>
        </header>

        {post.media.length > 0 && (
          <div className="overflow-hidden rounded-[12px]">
            <MediaGrid items={post.media} />
          </div>
        )}

        {post.comment && <p className="whitespace-pre-wrap break-words text-[14px] leading-[1.8] text-ink">{post.comment}</p>}

        <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
          {post.author.isDeleted ? (
            <span className="flex items-center gap-2 text-[12px] text-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={post.author.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
              {post.author.displayName}
            </span>
          ) : (
            <Link href={`/users/${post.author.id}`} className="flex items-center gap-2 text-[12px] text-ink">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={post.author.avatarUrl} alt={`${post.author.displayName}のアイコン画像`} className="h-7 w-7 rounded-full object-cover" />
              <span className="font-medium">{post.author.displayName}</span>
            </Link>
          )}
          <time dateTime={post.createdAt} className="text-[11px] text-muted">
            {new Date(post.createdAt).toLocaleString("ja-JP")} 投稿
          </time>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {post.canInteract && <LikeButton postId={post.id} initialLiked={post.viewerHasLiked} initialCount={post.likeCount} />}
          <SaveButton spotId={post.spot.id} initialSaved={post.isWishlisted} />
          <Link href={mapHref} className="inline-flex h-9 items-center gap-1 rounded-full border border-line bg-surface px-3 text-[12px] font-semibold text-ink">
            🗺 地図で見る
          </Link>
        </div>

        {/* spot-status-report Task2: 「この場所、まだありますか？」（公開投稿のみ。3.5.5） */}
        {post.canInteract && <SpotStatusButtons spotId={post.spot.id} initial={post.spotStatus} className="border-t border-line pt-3" />}

        {!post.isOwner && (
          <Link
            href={composeHref({ kind: "spot", spotId: post.spot.id })}
            className="inline-flex h-11 w-fit items-center gap-1.5 rounded-full bg-accent px-5 text-[13px] font-bold text-white"
          >
            ✍ 自分も投稿する
          </Link>
        )}

        <CommentSection postId={post.id} initialPage={initialComments} canComment={post.canInteract} returnTo={returnTo} />
      </article>
    </div>
  );
}
