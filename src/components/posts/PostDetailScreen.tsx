"use client";

import { Suspense, use } from "react";
import Link from "next/link";
import { MediaGrid } from "@/components/media/MediaGrid";
import { SaveButton } from "@/components/save/SaveButton";
import { LikeButton } from "@/components/likes/LikeButton";
import { CommentSection } from "@/components/comments/CommentSection";
import { CommentsSkeleton } from "@/components/skeleton/Skeletons";
import { buildReportHref } from "@/components/reports/report-href";
import { MoreMenu, MoreMenuItem } from "@/components/ui/MoreMenu";
import { useConfirm } from "@/components/ui/ConfirmSheet";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { useDeletePost } from "@/components/posts/use-delete-post";
import { formatStatusLabel } from "@/lib/spots/format-status-label";
import type { CommentPage } from "@/lib/comments/list-comments";
import type { PostDetailData } from "@/lib/posts/post-detail";
import { composeHref } from "@/lib/posts/compose-href";
import { appendBackHref, buildMapHrefWithBack } from "@/lib/search/list-state";
import { MapSheetLayout } from "@/components/layout/MapSheetLayout";
import { StaticSpotMap } from "@/components/map/StaticSpotMap";
import { formatCost } from "./PostCard";
import { BackLink } from "@/components/layout/BackLink";
import { formatDate, formatDateTime } from "@/lib/format/date-time";
import { TERMS } from "@/lib/terms";

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
  const backLabel = back?.label ?? TERMS.seePosts;
  const returnTo = `/posts/${post.id}`;
  const cost = formatCost(post.cost);
  // #875: 最新の報告（「9月にまだあった」）。報告そのものはスポットの画面で行う
  const statusLabel = formatStatusLabel(post.spotStatus.latest);

  /*
   * #862（2026-10-07）: 削除の確認はアプリ共通のシート（#778）で、**メニューの外**に置く。
   * メニューの中に置くと、押した瞬間にメニューごと消えて確認が出ない。
   */
  const { confirm, confirmSheet } = useConfirm();
  const { deletePost, isDeleting, errorMessage: deleteError } = useDeletePost(post.id);
  const confirmDelete = async () => {
    const ok = await confirm({
      title: "この投稿を削除しますか？",
      description: "この投稿に付いた写真・コメント・いいねも一緒に消えます。元に戻せません。",
      confirmLabel: "削除",
      danger: true,
    });
    if (!ok) return;
    await deletePost();
  };

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
      <div className="flex h-full w-full items-center justify-center bg-line text-[0.75rem] text-muted">
        位置情報のないスポット
      </div>
    );

  // map-sheet Task2: 地図を広くした段階でシートに出す 1 行（4.5.6）。スポット名・★・訪問日
  const summary = (
    <p className="flex items-center gap-x-2 px-4 pb-3 text-[0.8125rem] font-semibold text-ink" data-sheet-summary-line>
      <span className="truncate">{post.spot.name}</span>
      {post.rating !== null && (
        <span className="flex shrink-0 items-center gap-1 font-normal text-muted" aria-label={`星${post.rating}`}>
          <span className="text-star" aria-hidden>
            ★
          </span>
          <span>{post.rating}</span>
        </span>
      )}
      {post.visitDate && <span className="shrink-0 font-normal text-muted">訪問 {formatDate(post.visitDate)}</span>}
    </p>
  );

  return (
    <MapSheetLayout map={map} summary={summary}>
      {confirmSheet}
      <div className="flex flex-col items-center px-4 pt-2 pb-8">
        <article className="flex w-full max-w-[520px] flex-col gap-4">
          {notice}
          {deleteError && <ErrorNotice message={deleteError} />}
          <header className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              {/* #813: 戻るは共通部品（自前で ‹ を描かない） */}
              <BackLink href={backHref} label={backLabel} />
              <span className="flex-1" />
              {/*
                * #770（2026-10-06）: 他人の投稿では「通報する」が**右上に下線リンクで裸**だった。
                * 主役ではない操作なので「⋯」の中へ入れ、自分の投稿と同じ形にそろえる
                * （自分の投稿は 編集・削除。通報は出ない）。
                */}
              <MoreMenu>
                {post.isOwner ? (
                  <>
                    <MoreMenuItem label="編集" href={`/posts/${post.id}/edit`} />
                    {/*
                      * #862（2026-10-07）: 削除も「編集」と同じ共通部品にする。
                      *
                      * 【初心者向け】以前はここに**確認ダイアログごと持った部品**を置いていた。
                      * `MoreMenu` は内側のどこを押しても閉じるので、押した瞬間に部品ごと消え、
                      * **確認が出ず削除もできなかった**。確認は画面の側（メニューの外）で出す。
                      */}
                    <MoreMenuItem label="削除" danger disabled={isDeleting} onClick={() => void confirmDelete()} />
                  </>
                ) : (
                  <MoreMenuItem label="通報する" href={buildReportHref({ targetType: "post", targetId: post.id, returnTo })} />
                )}
              </MoreMenu>
            </div>

            <h1 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[1.125rem] font-bold leading-tight text-ink">
              <Link
                href={appendBackHref(`/spots/${post.spot.id}`, selfHref)}
                className="tap-target min-w-0 break-words"
              >
                {post.spot.name}
              </Link>
              {post.visibility === "private" && (
                <span className="rounded-full bg-line px-2 py-0.5 text-[0.625rem] font-semibold text-ink">
                  非公開
                </span>
              )}
            </h1>
            {/* strike-system Task 3: 本人にだけ、隠れている理由を出す（他人にはこの画面自体が出ない） */}
            {post.hiddenReason && (
              <p role="note" className="mb-2 rounded-[8px] bg-tint px-3 py-2 text-[0.75rem] leading-[1.7] text-ink">
                {post.hiddenReason === "auto"
                  ? "この投稿は通報が重なったため、運営が確認するまで他の人には表示されません（確認中）"
                  : post.hiddenReason === "suspension"
                    ? "この投稿はアカウントの停止に伴い非公開になっています"
                    : "この投稿は運営の判断で非公開になっています。理由はマイページの「アカウントの状態」で確認できます"}
              </p>
            )}
            <p className="flex flex-wrap items-center gap-x-1.5 text-[0.75rem] text-muted">
              <span>{post.spot.prefecture ?? "都道府県未設定"}</span>
              <span aria-hidden>・</span>
              <span className="rounded-full bg-tint px-2 py-0.5 text-accent">
                {post.category}
              </span>
            </p>
            <p
              className="text-[0.875rem]"
              aria-label={post.rating !== null ? `星${post.rating}` : "未評価"}
            >
              {post.rating !== null ? (
                /*
                  * #773（2026-10-06）: 「★★★☆☆ 星3」の**文字**を外した。
                  * 一覧では既に外してあり（docs/stars-and-trim）、詳細だけ残っていた。
                  * 星の数で分かることを、もう一度文字で書かない。
                  * 読み上げには上の `aria-label`（「星3」）が残るので意味は失わない。
                  */
                <>
                  <span className="text-star">{"★".repeat(post.rating)}</span>
                  <span className="text-line">
                    {"★".repeat(5 - post.rating)}
                  </span>
                </>
              ) : (
                <span className="text-[0.75rem] text-muted">未評価</span>
              )}
            </p>
            <dl className="flex flex-wrap gap-x-3 gap-y-1 text-[0.75rem] text-ink">
              <div className="flex gap-1">
                <dt className="text-muted">訪問日</dt>
                <dd>
                  {post.visitDate
                    ? formatDate(post.visitDate)
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
            <p className="whitespace-pre-wrap break-words text-[0.875rem] leading-[1.8] text-ink">
              {post.comment}
            </p>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
            {post.author.isDeleted ? (
              <span className="flex items-center gap-2 text-[0.75rem] text-muted">
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
                /* #767: 戻ると「‹ 投稿」でここに帰れるよう back を渡す */
                href={appendBackHref(`/users/${post.author.id}`, selfHref)}
                className="tap-target flex items-center gap-2 text-[0.75rem] text-ink"
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
            <time dateTime={post.createdAt} className="text-[0.6875rem] text-muted">
              {formatDateTime(post.createdAt)} 投稿
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

          {/*
            * #875（2026-10-07）: 「この場所、まだありますか？」の**ボタンはここから外した**。
            *
            * 【初心者向け】この報告はスポット単位（1 人 1 件）のもので、**投稿ではなく
            * スポットの情報**です。投稿は「ある人が行ったときの話」で、場所がいまもあるかとは
            * 別の話なので、報告はスポット別の一覧（SC-04）に置きました。
            * ここには**最新の報告を出すだけ**にします（要件 3.5.1）。
            */}
          {statusLabel && (
            <p className="border-t border-line pt-3 text-[0.8125rem] text-muted" data-spot-status-label>
              この場所は <span className="font-medium text-done">{statusLabel}</span>
              <Link href={appendBackHref(`/spots/${post.spot.id}`, selfHref)} className="ml-2 text-accent underline underline-offset-2">
                報告する
              </Link>
            </p>
          )}

          {!post.isOwner && (
            <Link
              href={composeHref({ kind: "spot", spotId: post.spot.id })}
              className="inline-flex h-11 w-fit items-center gap-1.5 rounded-full bg-accent px-5 text-[0.8125rem] font-bold text-white"
            >
              {TERMS.post}
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
