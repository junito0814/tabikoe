"use client";

import { useRouter } from "next/navigation";
import { MyMapScreen } from "@/components/map/MyMapScreen";
import { BackLink } from "@/components/layout/BackLink";
import { PullToRefresh } from "@/components/layout/PullToRefresh";
import { DraftsSection } from "./DraftsSection";
import { MyPostsList, type FetchMyPosts } from "./MyPostsList";
import type { DraftListPage } from "@/lib/posts/drafts";
import type { MyPostsPage } from "@/lib/users/my-page";
import type { MyMapMode } from "@/lib/map/get-my-map-pins";

/**
 * SC-12 投稿履歴（#682。v3.1 の「あしあと」から改称）
 * 出典: docs/tasks/records/my-page-v4/01-post-history.md
 *       要件定義書 3.6.5・ワイヤーフレーム決定事項 72
 *
 * 【初心者向け】マイページから開く。**一覧が既定**で、地図に切り替えられる。
 * 一覧はマイページにあった「自分の投稿」と「下書き」をそのまま移したもの
 * （部品は動かしていない）。地図は今までの「あしあと」そのまま。
 *
 * どちらを見ているかは URL（`?view=map`）に持つので、戻ってきても同じ側が開く。
 */
export type PostHistoryView = "list" | "map";

export function PostHistoryScreen({
  view,
  initialPosts,
  tripOptions,
  drafts,
  fetchPosts,
  initialMapMode,
}: {
  view: PostHistoryView;
  initialPosts: MyPostsPage;
  tripOptions: { id: string; title: string }[];
  drafts: DraftListPage | null;
  fetchPosts?: FetchMyPosts;
  initialMapMode: MyMapMode;
}) {
  const router = useRouter();

  const header = (
    <header className="flex flex-col gap-2">
      <BackLink />
      <div className="flex items-center gap-2">
        <h1 className="flex-1 text-[1.125rem] font-bold text-ink">投稿履歴</h1>
      </div>
      <div role="radiogroup" aria-label="表示" className="inline-flex w-fit rounded-full border border-line bg-surface p-0.5">
        {(["list", "map"] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={view === option}
            onClick={() => view !== option && router.replace(option === "map" ? "/mymap?view=map" : "/mymap")}
            className={`tap-target h-7 rounded-full px-3 text-[0.75rem] font-semibold ${view === option ? "bg-ink text-on-ink" : "text-muted"}`}
          >
            {option === "list" ? "一覧" : "地図"}
          </button>
        ))}
      </div>
    </header>
  );

  if (view === "map") {
    return (
      <div className="flex min-h-screen flex-col bg-app">
        <div className="px-4 pb-2 pt-4">{header}</div>
        <MyMapScreen initialMode={initialMapMode} />
      </div>
    );
  }

  return (
    <PullToRefresh>
      <div className="flex min-h-screen flex-col items-center bg-app px-4 py-6">
        <div className="flex w-full max-w-[520px] flex-col gap-4">
          {header}
          {/* #682: マイページから移した 2 つ。部品はそのまま */}
          {drafts && <DraftsSection initial={drafts} />}
          <MyPostsList initialPage={initialPosts} tripOptions={tripOptions} fetchPosts={fetchPosts} />
        </div>
      </div>
    </PullToRefresh>
  );
}
