import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUserFromClaims } from "@/lib/auth/auth-user";
import { GuestBand } from "@/components/layout/GuestBand";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { Suspense } from "react";
import { isVideoUploadDisabled } from "@/lib/video/process-video";
import { StreamingSpotPostListScreen } from "@/components/posts/StreamingSearchScreens";
import { MapSheetSkeleton } from "@/components/skeleton/Skeletons";
import { loadSearchFirstPage, loadSearchShell, retryableEmptyFirstPage, type SearchPageQuery } from "@/lib/search/load-search-page";
import { resolveListBack } from "@/lib/search/list-state";
import { ContentEnter } from "@/components/transitions/Reveal";
import { officialInfoSlot } from "@/components/spots/OfficialInfo";
import { visitFindingsSlot } from "@/components/spots/VisitFindingsSlot";
import { spotTitle } from "@/lib/metadata/page-title";
import { spotShareCard } from "@/lib/metadata/share-card";

/**
 * SC-04 投稿一覧（スポット別）
 * 出典: docs/tasks/map-search/post-timeline/04-spot-list-header-and-add-mode.md
 *
 * 【初心者向け】地図（SC-02）のピンの吹き出しや投稿カードのスポット名から来る。
 * 中身は `/search?spot=<id>` と同じ（lib/search/load-search-page.ts を共用）。
 * v1 からのリンク（/spots/[id]?sort=）もそのまま動く。
 *
 * #951（2026-10-17）: **ログインせずに開ける**ようにした（要件 3.5.4）。共有されたリンクを
 * 受け取った人が、ログイン画面に突き当たって中身を一切見られない状態を避けるため。
 * 中身は同じで、違うのは 4 つ ── メニューバー（`shouldShowMenuBar`）・「戻る」・「⋯」を出さず、
 * 下に帯（`GuestBand`）を 1 本置く。**どこから来たかでは判定しない**（同じ URL は同じ動き）。
 */
/**
 * #785: タブ名はスポット名。見つからない・見られないときは名前を出さない（存在が漏れるため）
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const name = await spotTitle(id);
  /*
   * #951: 検索エンジンには載せない（要件 4.5.18）。
   * 卒業制作で検索流入を目的としないことに加え、**Google の公式情報（6.2）はキャッシュできず
   * 画面を開くたびに 1 回呼ぶ**ので、クローラの巡回がそのまま無料枠を使ってしまうため。
   */
  const robots = { index: false } as const;
  if (!name) return { robots };
  /*
   * #952（2026-10-17）: 共有したときに出るリンクカード。
   * `robots: { index: false }` とは両立する（検索には載せないが、カードは読まれる）。
   */
  return { title: name, robots, ...(await spotShareCard(id, name)) };
}

export default async function SpotPostsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchPageQuery>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  // #951: ログインは必須ではない。未ログインなら user が null のまま進む
  const user = await getAuthUserFromClaims(supabase);
  const viewerId = user?.id ?? null;
  const isGuest = viewerId === null;

  const query = await searchParams;
  const admin = createAdminClient();
  // performance Task2: 骨組みだけ待ち、1 ページ目はストリーミング（/search と同じ）
  const data = await loadSearchShell(admin, viewerId, { ...query, spot: id });
  if (data.kind === "spot_missing") notFound();
  if (data.kind === "error" || !data.spot) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app px-6">
        <ErrorNotice message={ERROR_MESSAGES.dbLoadFailure} retryable className="w-full max-w-[360px]" />
      </div>
    );
  }

  const shell = data;
  const firstPage = loadSearchFirstPage(admin, viewerId, shell).catch(() => retryableEmptyFirstPage(shell));
  const back = resolveListBack(typeof query.back === "string" ? query.back : null);
  return (
    <ContentEnter>
      <Suspense fallback={<MapSheetSkeleton backLabel={back?.label ?? "地図"} title={data.spot.name} />}>
        <StreamingSpotPostListScreen
          videoEnabled={!isVideoUploadDisabled()}
          spot={data.spot}
          initialState={data.initialState}
          addMode={data.addMode}
          back={back}
          firstPage={firstPage}
          /* #701・#739: Google の公式情報（中身は officialInfoSlot にまとめてある） */
          official={officialInfoSlot(id)}
          /* #929: 行ってわかったこと（報告が 1 件も無ければ、中で何も出さない） */
          visitFindings={visitFindingsSlot(id)}
          isGuest={isGuest}
        />
      </Suspense>
      {/* #951: 未ログインはメニューバーの代わりにこの帯（要件 4.5.18） */}
      {isGuest && <GuestBand returnTo={`/spots/${id}`} />}
    </ContentEnter>
  );
}
