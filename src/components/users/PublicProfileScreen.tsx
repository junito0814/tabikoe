"use client";

import { BackLink } from "@/components/layout/BackLink";
import { MoreMenu, MoreMenuItem } from "@/components/ui/MoreMenu";
import { buildReportHref } from "@/components/reports/report-href";
import { PostCard } from "@/components/posts/PostCard";
import { BlockUserButton } from "@/components/blocks/BlockUserButton";
import type { PostCardData } from "@/lib/posts/post-cards";
import type { PublicProfileStats } from "@/lib/users/public-profile";

/**
 * SC-33 他ユーザーのプロフィール
 * 出典: 要件定義書 3.5.6（2026-10-06 で新設）／Issue #767
 *
 * 【初心者向け】投稿カード・投稿詳細・コメントの**名前を押すと開く**画面です。
 * これまで**仕様が無く**（画面番号も無く）、アイコン・名前・「通報する」「ブロック」だけでした。
 *
 * 自分のマイページ（3.6.1）の材料のうち、**編集できないもの**を出します。
 * アルバム・しおり・行きたいは**本人だけのもの**なので出しません。
 */
export function PublicProfileScreen({
  userId,
  displayName,
  avatarUrl,
  stats,
  posts,
  isSelf,
  back,
  selfHref,
}: {
  userId: string;
  displayName: string;
  avatarUrl: string;
  stats: PublicProfileStats;
  posts: PostCardData[];
  isSelf: boolean;
  /** 来た画面（#813 と同じ決め方）。無ければホーム */
  back: { href: string; label: string } | null;
  selfHref: string;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center bg-app px-4 pb-24 pt-4">
      <div className="flex w-full max-w-[520px] flex-col gap-4">
        <header className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            {/* #767: 戻るが無かった（要件 4.5.13） */}
            <BackLink href={back?.href ?? "/"} label={back?.label ?? "ホーム"} />
            <span className="flex-1" />
            {/* #767: 通報・ブロックは下線のリンクではなく「⋯」の中（要件 4.5.15・4.5.16） */}
            {!isSelf && (
              <MoreMenu>
                <MoreMenuItem label="通報する" href={buildReportHref({ targetType: "user", targetId: userId, returnTo: selfHref })} />
                <li role="presentation" className="px-3 py-1.5">
                  <BlockUserButton targetUserId={userId} targetDisplayName={displayName} />
                </li>
              </MoreMenu>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatarUrl} alt={`${displayName}のアイコン画像`} className="h-16 w-16 shrink-0 rounded-full object-cover" />
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="break-words text-[1.0625rem] font-bold text-ink">{displayName}</p>
              {/* 自分のマイページと同じ数え方。ここでは押しても開かない（他人のバッジ一覧は無い） */}
              <p className="text-[0.75rem] text-muted">
                バッジ {stats.badgeCount} / {stats.badgeTotal}
              </p>
            </div>
          </div>

          <dl className="flex gap-4 text-[0.75rem] text-muted" data-profile-stats>
            {([
              ["投稿", stats.postCount],
              ["獲得いいね", stats.receivedLikeCount],
              ["登録した場所", stats.registeredSpotCount],
            ] as const).map(([label, value]) => (
              <div key={label} className="flex items-baseline gap-1">
                <dt>{label}</dt>
                <dd className="text-[0.9375rem] font-bold text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </header>

        {posts.length === 0 ? (
          <p className="py-10 text-center text-[0.8125rem] text-muted">まだ公開された投稿はありません</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {posts.map((post) => (
              <li key={post.id}>
                {/* 名前はこの画面なので出さない。保存の「＋」は他の一覧と同じ */}
                <PostCard post={post} backHref={selfHref} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
