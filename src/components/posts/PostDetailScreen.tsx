import Link from "next/link";
import { MediaGrid } from "@/components/media/MediaGrid";
import { WishlistButton } from "@/components/wishlist/WishlistButton";
import { LikeButton } from "@/components/likes/LikeButton";
import { CommentSection } from "@/components/comments/CommentSection";
import { ReportLink } from "@/components/reports/ReportLink";
import { DeletePostButton } from "@/components/posts/DeletePostButton";
import type { CommentPage } from "@/lib/comments/list-comments";
import type { PostDetailData } from "@/lib/posts/post-detail";
import { formatCost } from "./PostCard";

/**
 * F-VW-01 Task2: 投稿詳細画面（SC-05）
 * 出典: docs/tasks/browsing/post-detail-view/02-post-detail-ui.md
 *       要件定義書3.5.1
 *
 * 投稿の全項目（スポット名・カテゴリ・日付・滞在時間・費用・星評価・写真・動画・感想・投稿者・投稿日時）と
 * コメント欄を表示する。**旅行タイトルは表示しない**（3.3.4 の表示範囲）。
 * 写真・動画は shared-ui/media-layout（MediaGrid）、コメント欄は F-VW-03（CommentSection）、
 * 「行きたい」は F-RC-05（WishlistButton）、いいねは F-VW-02（LikeButton）を組み込む。
 * 削除ボタン（F-PO-03 Task4）と編集への導線は投稿者本人にだけ出す。
 *
 * 【初心者向け】このファイルには "use client" が無い＝Server Component。state や onClick を持たず、
 * サーバーで取ってきた `post`（PostDetailData）をそのまま並べるだけ。ボタンの動き（いいね・コメント・削除）は
 * それぞれ子コンポーネント（"use client"）に閉じ込めてある。誰が見ているかによる出し分けは
 * `post.isOwner`（本人）・`post.canInteract`（公開投稿でいいね・コメント可）をサーバー側で計算して渡している。
 */
export function PostDetailScreen({
  post,
  initialComments,
}: {
  post: PostDetailData;
  initialComments: CommentPage;
}) {
  // 通報画面から戻ってくる先。コメントの通報でも同じ投稿詳細に戻す
  const returnTo = `/posts/${post.id}`;
  const cost = formatCost(post.cost);

  return (
    <div className="flex min-h-screen flex-col items-center bg-[#FBF6F0] px-4 py-6">
      <article className="flex w-full max-w-[520px] flex-col gap-4">
        <header className="flex flex-col gap-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link href={`/spots/${post.spot.id}`} className="block truncate text-[18px] font-bold text-[#3D3A35]">
                {post.spot.name}
              </Link>
              <p className="mt-0.5 text-[11px] text-[#9C9488]">
                {post.spot.prefecture ?? "都道府県未設定"}
                {post.visibility === "private" && <span className="ml-2 rounded-full bg-[#E8E1D8] px-2 py-0.5 text-[#3D3A35]">非公開</span>}
              </p>
            </div>
            <WishlistButton spotId={post.spot.id} initialSaved={post.isWishlisted} className="shrink-0" />
          </div>
          <dl className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[#3D3A35]">
            <div className="flex gap-1">
              <dt className="text-[#9C9488]">カテゴリ</dt>
              <dd className="rounded-full bg-white px-2 text-[#C4703F]">{post.category}</dd>
            </div>
            <div className="flex gap-1">
              <dt className="text-[#9C9488]">訪問日</dt>
              <dd>{post.visitDate ? new Date(post.visitDate).toLocaleDateString("ja-JP") : "未入力"}</dd>
            </div>
            <div className="flex gap-1">
              <dt className="text-[#9C9488]">滞在時間</dt>
              <dd>{post.duration ?? "未入力"}</dd>
            </div>
            <div className="flex gap-1">
              <dt className="text-[#9C9488]">費用</dt>
              <dd>{cost ?? "未入力"}</dd>
            </div>
            <div className="flex gap-1">
              <dt className="text-[#9C9488]">評価</dt>
              <dd aria-label={post.rating !== null ? `星${post.rating}` : "未評価"}>
                {post.rating !== null ? (
                  <>
                    <span className="text-[#C4703F]">{"★".repeat(post.rating)}</span>
                    <span className="text-[#E8E1D8]">{"★".repeat(5 - post.rating)}</span>
                  </>
                ) : (
                  "未評価"
                )}
              </dd>
            </div>
          </dl>
        </header>

        {post.media.length > 0 && (
          <div className="overflow-hidden rounded-[12px]">
            <MediaGrid items={post.media} />
          </div>
        )}

        {post.comment && (
          <p className="whitespace-pre-wrap break-words text-[14px] leading-[1.8] text-[#3D3A35]">{post.comment}</p>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-[#E8E1D8] pt-3">
          {post.author.isDeleted ? (
            <span className="flex items-center gap-2 text-[12px] text-[#9C9488]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={post.author.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
              {post.author.displayName}
            </span>
          ) : (
            <Link href={`/users/${post.author.id}`} className="flex items-center gap-2 text-[12px] text-[#3D3A35]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={post.author.avatarUrl} alt={`${post.author.displayName}のアイコン画像`} className="h-7 w-7 rounded-full object-cover" />
              <span className="font-medium">{post.author.displayName}</span>
            </Link>
          )}
          <time dateTime={post.createdAt} className="text-[11px] text-[#9C9488]">
            {new Date(post.createdAt).toLocaleString("ja-JP")}
          </time>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {post.canInteract && (
            <LikeButton postId={post.id} initialLiked={post.viewerHasLiked} initialCount={post.likeCount} />
          )}
          {post.isOwner ? (
            <>
              <Link href={`/posts/${post.id}/edit`} className="text-[13px] font-medium text-[#3D3A35] underline underline-offset-2">
                編集
              </Link>
              <DeletePostButton postId={post.id} />
            </>
          ) : (
            <ReportLink targetType="post" targetId={post.id} returnTo={returnTo} />
          )}
        </div>

        <CommentSection
          postId={post.id}
          initialPage={initialComments}
          canComment={post.canInteract}
          returnTo={returnTo}
        />
      </article>
    </div>
  );
}
