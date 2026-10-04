"use client";

import { Suspense, use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MediaGrid } from "@/components/media/MediaGrid";
import { SaveButton } from "@/components/save/SaveButton";
import { LikeButton } from "@/components/likes/LikeButton";
import { CommentSection } from "@/components/comments/CommentSection";
import { CommentsSkeleton } from "@/components/skeleton/Skeletons";
import { ReportLink } from "@/components/reports/ReportLink";
import { DeletePostButton } from "@/components/posts/DeletePostButton";
import { SpotStatusButtons } from "@/components/spots/SpotStatusButtons";
import type { CommentPage } from "@/lib/comments/list-comments";
import type { PostDetailData } from "@/lib/posts/post-detail";
import { composeHref } from "@/lib/posts/compose-href";
import { appendBackHref, buildMapHrefWithBack } from "@/lib/search/list-state";
import { MapSheetLayout } from "@/components/layout/MapSheetLayout";
import { StaticSpotMap } from "@/components/map/StaticSpotMap";
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
 *   5. 「いいね」「＋」（保存先シート）、「この場所、まだありますか？」（SpotStatusButtons）、「自分も投稿する」。「地図で見る」は上 1/3 の地図が兼ねる（v3.1）
 *   6. コメント欄
 * 旅行タイトルは表示しない（3.3.4）。非公開投稿ではいいね・コメント欄・まだあったを出さない。
 * `post.isOwner`（本人）・`post.canInteract`（公開投稿）はサーバーで計算して渡される。
 */
export function PostDetailScreen({
  post,
  initialComments,
  notice,
  back = null,
}: {
  post: PostDetailData;
  /** performance Task2: page.tsx は Promise のまま渡す（コメントは本文の後から流し込む）。テストでは値でもよい */
  initialComments: CommentPage | Promise<CommentPage>;
  /** 投稿・更新の完了メッセージ（Server Component から渡す。v3.0） */
  notice?: React.ReactNode;
  /** Bug #469・#471: 一覧などから `?back=` で渡された戻り先（URL と画面名）。無ければそのスポットの一覧（「投稿一覧」） */
  back?: { href: string; label: string } | null;
}) {
  // Bug #471: この画面の URL（back を含む）。ここから開く地図・スポット別一覧の戻り先にする
  const selfHref = appendBackHref(`/posts/${post.id}`, back?.href);
  const backHref = back?.href ?? `/spots/${post.spot.id}`;
  const backLabel = back?.label ?? "投稿一覧";
  const returnTo = `/posts/${post.id}`;
  const cost = formatCost(post.cost);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isMenuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node))
        setIsMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [isMenuOpen]);

  // 上の地図（SC-02）からは「← スポット名」でこの投稿に戻る（要件 8 章 46）
  const mapHref = buildMapHrefWithBack({ spot: post.spot.id, lat: post.spot.lat, lng: post.spot.lng }, selfHref);

  // v3.1（mentoring-7 Task4）: 上 1/3 に見るだけの地図（タップで SC-02）、下 2/3 に内容。「地図で見る」ボタンは置かない
  const map =
    post.spot.lat !== null && post.spot.lng !== null ? (
      <StaticSpotMap
        spot={{
          id: post.spot.id,
          name: post.spot.name,
          lat: post.spot.lat,
          lng: post.spot.lng,
        }}
        href={mapHref}
        className="h-full w-full"
      />
    ) : (
      <div className="flex h-full w-full items-center justify-center bg-line text-[12px] text-muted">
        位置情報のないスポット
      </div>
    );

  // map-sheet Task2: 地図を広くした段階でシートに出す 1 行（4.5.6）。スポット名・★・訪問日
  const summary = (
    <p className="flex items-center gap-x-2 px-4 pb-3 text-[13px] font-semibold text-ink" data-sheet-summary-line>
      <span className="truncate">{post.spot.name}</span>
      {post.rating !== null && (
        <span className="flex shrink-0 items-center gap-1 font-normal text-muted" aria-label={`星${post.rating}`}>
          <span className="text-star" aria-hidden>
            ★
          </span>
          <span>{post.rating}</span>
        </span>
      )}
      {post.visitDate && <span className="shrink-0 font-normal text-muted">訪問 {new Date(post.visitDate).toLocaleDateString("ja-JP")}</span>}
    </p>
  );

  return (
    <MapSheetLayout map={map} summary={summary}>
      <div className="flex flex-col items-center px-4 pt-2 pb-8">
        <article className="flex w-full max-w-[520px] flex-col gap-4">
          {notice}
          <header className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Link
                href={backHref}
                className="inline-flex h-8 shrink-0 items-center gap-1 text-[12px] font-medium text-muted"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden
                >
                  <path
                    d="M15 5l-7 7 7 7"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {backLabel}
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
                    <div
                      role="menu"
                      className="absolute right-0 z-20 mt-1 flex min-w-[140px] flex-col overflow-hidden rounded-[10px] border border-line bg-surface py-1 shadow-card"
                    >
                      <Link
                        href={`/posts/${post.id}/edit`}
                        role="menuitem"
                        className="px-3 py-2 text-[13px] text-ink hover:bg-tint"
                      >
                        編集
                      </Link>
                      <div className="px-3 py-1.5">
                        <DeletePostButton postId={post.id} />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <ReportLink
                  targetType="post"
                  targetId={post.id}
                  returnTo={returnTo}
                />
              )}
            </div>

            <h1 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[18px] font-bold leading-tight text-ink">
              <Link
                href={appendBackHref(`/spots/${post.spot.id}`, selfHref)}
                className="min-w-0 break-words"
              >
                {post.spot.name}
              </Link>
              {post.visibility === "private" && (
                <span className="rounded-full bg-line px-2 py-0.5 text-[10px] font-semibold text-ink">
                  非公開
                </span>
              )}
            </h1>
            {/* strike-system Task 3: 本人にだけ、隠れている理由を出す（他人にはこの画面自体が出ない） */}
            {post.hiddenReason && (
              <p role="note" className="mb-2 rounded-[8px] bg-tint px-3 py-2 text-[12px] leading-[1.7] text-ink">
                {post.hiddenReason === "auto"
                  ? "この投稿は通報が重なったため、運営が確認するまで他の人には表示されません（確認中）"
                  : post.hiddenReason === "suspension"
                    ? "この投稿はアカウントの停止に伴い非公開になっています"
                    : "この投稿は運営の判断で非公開になっています。理由はマイページの「アカウントの状態」で確認できます"}
              </p>
            )}
            <p className="flex flex-wrap items-center gap-x-1.5 text-[12px] text-muted">
              <span>{post.spot.prefecture ?? "都道府県未設定"}</span>
              <span aria-hidden>・</span>
              <span className="rounded-full bg-tint px-2 py-0.5 text-accent">
                {post.category}
              </span>
            </p>
            <p
              className="text-[14px]"
              aria-label={post.rating !== null ? `星${post.rating}` : "未評価"}
            >
              {post.rating !== null ? (
                <>
                  <span className="text-star">{"★".repeat(post.rating)}</span>
                  <span className="text-line">
                    {"★".repeat(5 - post.rating)}
                  </span>
                  <span className="ml-1.5 text-[12px] text-muted">
                    星{post.rating}
                  </span>
                </>
              ) : (
                <span className="text-[12px] text-muted">未評価</span>
              )}
            </p>
            <dl className="flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-ink">
              <div className="flex gap-1">
                <dt className="text-muted">訪問日</dt>
                <dd>
                  {post.visitDate
                    ? new Date(post.visitDate).toLocaleDateString("ja-JP")
                    : "未入力"}
                </dd>
              </div>
              <div className="flex gap-1">
                <dt className="text-muted">滞在</dt>
                <dd>{post.duration ?? "未入力"}</dd>
              </div>
              <div className="flex gap-1">
                <dt className="text-muted">費用</dt>
                <dd>
                  {cost ? (cost === "無料" ? cost : `${cost}/人`) : "未入力"}
                </dd>
              </div>
            </dl>
          </header>

          {post.media.length > 0 && (
            <div className="overflow-hidden rounded-[12px]">
              <MediaGrid items={post.media} morphPostId={post.id} />
            </div>
          )}

          {post.comment && (
            <p className="whitespace-pre-wrap break-words text-[14px] leading-[1.8] text-ink">
              {post.comment}
            </p>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
            {post.author.isDeleted ? (
              <span className="flex items-center gap-2 text-[12px] text-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={post.author.avatarUrl}
                  alt=""
                  className="h-7 w-7 rounded-full object-cover"
                />
                {post.author.displayName}
              </span>
            ) : (
              <Link
                href={`/users/${post.author.id}`}
                className="flex items-center gap-2 text-[12px] text-ink"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={post.author.avatarUrl}
                  alt={`${post.author.displayName}のアイコン画像`}
                  className="h-7 w-7 rounded-full object-cover"
                />
                <span className="font-medium">{post.author.displayName}</span>
              </Link>
            )}
            <time dateTime={post.createdAt} className="text-[11px] text-muted">
              {new Date(post.createdAt).toLocaleString("ja-JP")} 投稿
            </time>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {post.canInteract && (
              <LikeButton
                postId={post.id}
                initialLiked={post.viewerHasLiked}
                initialCount={post.likeCount}
              />
            )}
            <SaveButton
              spotId={post.spot.id}
              initialSaved={post.isWishlisted}
            />
          </div>

          {/* spot-status-report Task2: 「この場所、まだありますか？」（公開投稿のみ。3.5.5） */}
          {post.canInteract && (
            <SpotStatusButtons
              spotId={post.spot.id}
              initial={post.spotStatus}
              className="border-t border-line pt-3"
            />
          )}

          {!post.isOwner && (
            <Link
              href={composeHref({ kind: "spot", spotId: post.spot.id })}
              className="inline-flex h-11 w-fit items-center gap-1.5 rounded-full bg-accent px-5 text-[13px] font-bold text-white"
            >
              ✍ 自分も投稿する
            </Link>
          )}

          {/* performance Task2: コメント欄は本文の後から流し込む（届くまで骨組み） */}
          <Suspense fallback={<CommentsSkeleton />}>
            <StreamedCommentSection postId={post.id} initialComments={initialComments} canComment={post.canInteract} returnTo={returnTo} />
          </Suspense>
        </article>
      </div>
    </MapSheetLayout>
  );
}

/**
 * コメント 1 ページ目が Promise なら `use()` で待ってから CommentSection を描く（値ならそのまま）。
 * 【初心者向け】`use(promise)` は「まだなら外側の Suspense に骨組みを出させ、届いたら続きを描く」React の仕組み。
 */
function StreamedCommentSection({ postId, initialComments, canComment, returnTo }: { postId: string; initialComments: CommentPage | Promise<CommentPage>; canComment: boolean; returnTo: string }) {
  const page = initialComments instanceof Promise ? use(initialComments) : initialComments;
  return <CommentSection postId={postId} initialPage={page} canComment={canComment} returnTo={returnTo} />;
}
