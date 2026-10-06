import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUserOrRedirect } from "@/lib/auth/require-user-or-redirect";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { Suspense } from "react";
import { StreamingSpotPostListScreen } from "@/components/posts/StreamingSearchScreens";
import { MapSheetSkeleton } from "@/components/skeleton/Skeletons";
import { loadSearchFirstPage, loadSearchShell, retryableEmptyFirstPage, type SearchPageQuery } from "@/lib/search/load-search-page";
import { resolveListBack } from "@/lib/search/list-state";
import { ContentEnter } from "@/components/transitions/Reveal";
import { officialInfoSlot } from "@/components/spots/OfficialInfo";

/**
 * SC-04 投稿一覧（スポット別）
 * 出典: docs/tasks/map-search/post-timeline/04-spot-list-header-and-add-mode.md
 *
 * 【初心者向け】地図（SC-02）のピンの吹き出しや投稿カードのスポット名から来る。
 * 中身は `/search?spot=<id>` と同じ（lib/search/load-search-page.ts を共用）。
 * v1 からのリンク（/spots/[id]?sort=）もそのまま動く。
 */
export default async function SpotPostsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchPageQuery>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await requireUserOrRedirect(supabase, `/spots/${id}`);

  const query = await searchParams;
  const admin = createAdminClient();
  // performance Task2: 骨組みだけ待ち、1 ページ目はストリーミング（/search と同じ）
  const data = await loadSearchShell(admin, user.id, { ...query, spot: id });
  if (data.kind === "spot_missing") notFound();
  if (data.kind === "error" || !data.spot) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app px-6">
        <ErrorNotice message={ERROR_MESSAGES.dbLoadFailure} retryable className="w-full max-w-[360px]" />
      </div>
    );
  }

  const shell = data;
  const firstPage = loadSearchFirstPage(admin, user.id, shell).catch(() => retryableEmptyFirstPage(shell));
  const back = resolveListBack(typeof query.back === "string" ? query.back : null);
  return (
    <ContentEnter>
      <Suspense fallback={<MapSheetSkeleton backLabel={back?.label ?? "地図"} title={data.spot.name} />}>
        <StreamingSpotPostListScreen
          spot={data.spot}
          initialState={data.initialState}
          addMode={data.addMode}
          back={back}
          firstPage={firstPage}
          /* #701・#739: Google の公式情報（中身は officialInfoSlot にまとめてある） */
          official={officialInfoSlot(id)}
        />
      </Suspense>
    </ContentEnter>
  );
}
