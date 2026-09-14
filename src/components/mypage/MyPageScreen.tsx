import Link from "next/link";
import type { MyPageSummary, MyPostsPage } from "@/lib/users/my-page";
import { MyPageMenu } from "./MyPageMenu";
import { MyPostsList, type FetchMyPosts } from "./MyPostsList";

export interface MyPageProfile {
  displayName: string;
  avatarUrl: string;
  isAdmin: boolean;
}

/**
 * F-RC-01 Task1〜4: マイページ（SC-06）
 * 出典: docs/tasks/records/my-page/01-my-page-layout.md
 *       要件定義書3.6.1（プロフィール → サマリー → 遷移メニュー → 自分の投稿一覧）
 *
 * 管理者（is_admin）への導線は 4.2 に従いメニューバーではなくプロフィール側に置く。
 */
export function MyPageScreen({
  profile,
  summary,
  initialPosts,
  tripOptions,
  fetchPosts,
}: {
  profile: MyPageProfile;
  summary: MyPageSummary;
  initialPosts: MyPostsPage;
  tripOptions: { id: string; title: string }[];
  fetchPosts?: FetchMyPosts;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center bg-[#FBF6F0] px-4 py-6">
      <div className="flex w-full max-w-[520px] flex-col gap-5">
        {/* 1. プロフィール */}
        <section aria-label="プロフィール" className="flex items-center gap-3 rounded-[12px] border border-[#E8E1D8] bg-white p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={profile.avatarUrl} alt={`${profile.displayName}のアイコン画像`} className="h-16 w-16 rounded-full object-cover" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[16px] font-bold text-[#3D3A35]">{profile.displayName}</h1>
            <div className="mt-1 flex flex-wrap gap-3 text-[12px]">
              <Link href="/account" className="font-medium text-[#C4703F] underline underline-offset-2">
                プロフィールを編集
              </Link>
              {profile.isAdmin && (
                <Link href="/admin" className="font-medium text-[#9C9488] underline underline-offset-2">
                  管理者ダッシュボード
                </Link>
              )}
            </div>
          </div>
        </section>

        {/* 2. サマリー */}
        <section aria-label="サマリー" className="grid grid-cols-2 gap-2">
          <div className="rounded-[12px] border border-[#E8E1D8] bg-white p-3 text-center">
            <p className="text-[11px] text-[#9C9488]">投稿数</p>
            <p className="text-[20px] font-bold text-[#3D3A35]" data-summary="postCount">{summary.postCount}</p>
          </div>
          <div className="rounded-[12px] border border-[#E8E1D8] bg-white p-3 text-center">
            <p className="text-[11px] text-[#9C9488]">獲得いいね</p>
            <p className="text-[20px] font-bold text-[#3D3A35]" data-summary="receivedLikeCount">{summary.receivedLikeCount}</p>
          </div>
        </section>

        {/* 3. 遷移メニュー */}
        <MyPageMenu />

        {/* 4. 自分の投稿一覧 */}
        <MyPostsList initialPage={initialPosts} tripOptions={tripOptions} fetchPosts={fetchPosts} />
      </div>
    </div>
  );
}
