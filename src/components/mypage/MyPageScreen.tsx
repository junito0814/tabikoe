import Link from "next/link";
import type { MyPageSummary, MyPostsPage } from "@/lib/users/my-page";
import type { DraftListPage } from "@/lib/posts/drafts";
import { DraftsSection } from "./DraftsSection";
import { MyPageMenu } from "./MyPageMenu";
import { MyPostsList, type FetchMyPosts } from "./MyPostsList";
import { PullToRefresh } from "@/components/layout/PullToRefresh";

export interface MyPageProfile {
  displayName: string;
  avatarUrl: string;
  isAdmin: boolean;
}

/**
 * F-RC-01 Task1〜4 / my-page-v3 Task1（v3.0）: マイページ（SC-06）
 * 出典: docs/tasks/records/my-page/01-my-page-layout.md
 *       docs/tasks/records/my-page-v3/01-drafts-section-and-menu.md
 *       要件定義書 v3.0 3.6.1（プロフィール → 下書き（あるときだけ）→ サマリー → 遷移メニュー 4 つ → 自分の投稿一覧）
 *
 * 管理者（is_admin）への導線は 4.2 に従いメニューバーではなくプロフィール側に置く。
 * 投稿数（summary.postCount）は公開済みだけを数え、下書きは含まない（lib/users/my-page.ts）。
 */
export function MyPageScreen({
  profile,
  summary,
  initialPosts,
  tripOptions,
  drafts,
  wishlistCount,
  restrictedUntil = null,
  fetchPosts,
}: {
  profile: MyPageProfile;
  summary: MyPageSummary;
  initialPosts: MyPostsPage;
  tripOptions: { id: string; title: string }[];
  /** v3.0: 下書き（あるときだけ段を出す） */
  drafts?: DraftListPage;
  wishlistCount?: number;
  /** strike-system Task 5: 投稿禁止中なら解除日時。先頭に帯を出す */
  restrictedUntil?: string | null;
  fetchPosts?: FetchMyPosts;
}) {
  return (
    <PullToRefresh>
      <div className="flex min-h-screen flex-col items-center bg-app px-4 py-6">
        <div className="flex w-full max-w-[520px] flex-col gap-5">
          {/* strike-system Task 5: 投稿禁止中は先頭に帯（詳しくはアカウントの状態へ） */}
          {restrictedUntil && (
            <Link href="/account/status" role="note" className="rounded-[12px] border border-accent/40 bg-tint p-3 text-[12px] leading-[1.7] text-ink">
              いま、投稿とコメントができません（{new Date(restrictedUntil).getMonth() + 1}/{new Date(restrictedUntil).getDate()} まで）。理由はアカウントの状態で確認できます ›
            </Link>
          )}
          {/* 1. プロフィール */}
          <section aria-label="プロフィール" className="flex items-center gap-3 rounded-[12px] border border-line bg-surface p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={profile.avatarUrl} alt={`${profile.displayName}のアイコン画像`} className="h-16 w-16 rounded-full object-cover" />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[16px] font-bold text-ink">{profile.displayName}</h1>
              <div className="mt-1 flex flex-wrap gap-3 text-[12px]">
                <Link href="/account" className="font-medium text-accent underline underline-offset-2">
                  プロフィールを編集
                </Link>
                {profile.isAdmin && (
                  <Link href="/admin" className="font-medium text-muted underline underline-offset-2">
                    管理者ダッシュボード
                  </Link>
                )}
              </div>
            </div>
          </section>

          {/* 1.5 下書き（あるときだけ。my-page-v3 Task1） */}
          {drafts && <DraftsSection initial={drafts} />}

          {/* 2. サマリー */}
          <section aria-label="サマリー" className="grid grid-cols-2 gap-2">
            <div className="rounded-[12px] border border-line bg-surface p-3 text-center">
              <p className="text-[11px] text-muted">投稿数</p>
              <p className="text-[20px] font-bold text-ink" data-summary="postCount">{summary.postCount}</p>
            </div>
            <div className="rounded-[12px] border border-line bg-surface p-3 text-center">
              <p className="text-[11px] text-muted">獲得いいね</p>
              <p className="text-[20px] font-bold text-ink" data-summary="receivedLikeCount">{summary.receivedLikeCount}</p>
            </div>
          </section>

          {/* 3. 遷移メニュー */}
          <MyPageMenu wishlistCount={wishlistCount} isRestricted={!!restrictedUntil} />

          {/* 4. 自分の投稿一覧 */}
          <MyPostsList initialPage={initialPosts} tripOptions={tripOptions} fetchPosts={fetchPosts} />
        </div>
      </div>
    </PullToRefresh>
  );
}
