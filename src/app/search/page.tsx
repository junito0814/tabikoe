import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUserOrRedirect } from "@/lib/auth/require-user-or-redirect";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { Suspense } from "react";
import { StreamingSpotPostListScreen, StreamingSpotSearchScreen } from "@/components/posts/StreamingSearchScreens";
import { MapSheetSkeleton, PostSearchSkeleton } from "@/components/skeleton/Skeletons";
import { loadSearchFirstPage, loadSearchShell, retryableEmptyFirstPage, type SearchPageQuery } from "@/lib/search/load-search-page";
import { resolveListBack } from "@/lib/search/list-state";
import { ContentEnter } from "@/components/transitions/Reveal";

/**
 * SC-04 投稿一覧（タイムライン形式・検索結果）
 * 出典: docs/tasks/map-search/post-timeline/02-timeline-ui.md
 *       docs/tasks/map-search/post-timeline/03-scroll-and-back.md
 *       要件定義書 v3.0 3.4.2
 *
 * 【初心者向け】検索トップ（SC-00）で行き先を決めると、ここに来る。URL が条件そのもの:
 *   /search?pref=大阪府 ／ /search?lat=&lng=&q=大阪駅 ／ /search?spot=<id>（スポット別）
 * 読み込みは lib/search/load-search-page.ts にまとめ、行き先の種類で画面を出し分ける。
 * 「戻る」は検索トップ（ホーム）へ。スポット別は `?back=`（検索結果から来たならその URL）へ、無ければ地図へ（Bug #469）。
 */
export default async function SearchPage({ searchParams }: { searchParams: Promise<SearchPageQuery> }) {
  const supabase = await createClient();
  const query = await searchParams;
  const qs = new URLSearchParams(Object.entries(query).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : []))).toString();
  const user = await requireUserOrRedirect(supabase, `/search${qs ? `?${qs}` : ""}`);

  const admin = createAdminClient();
  // performance Task2: 骨組み（行き先・見出し）だけ待ち、1 ページ目は Promise のまま画面に渡してストリーミングする。
  // 1 ページ目が失敗したら「空で、すぐ取り直す」ページにして、画面側の再取得とエラー表示に任せる
  const data = await loadSearchShell(admin, user.id, query);
  if (data.kind === "spot_missing") notFound();
  if (data.kind === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app px-6">
        <ErrorNotice message={ERROR_MESSAGES.dbLoadFailure} retryable className="w-full max-w-[360px]" />
      </div>
    );
  }

  const shell = data;
  const firstPage = loadSearchFirstPage(admin, user.id, shell).catch(() => retryableEmptyFirstPage(shell));

  if (data.spot) {
    const back = resolveListBack(typeof query.back === "string" ? query.back : null);
    return (
      <Suspense fallback={<MapSheetSkeleton backLabel={back?.label ?? "地図"} title={data.spot.name} />}>
        <StreamingSpotPostListScreen spot={data.spot} initialState={data.initialState} addMode={data.addMode} back={back} firstPage={firstPage} />
      </Suspense>
    );
  }

  // v3.1（mentoring-7 Task3）: 検索結果（都道府県・駅・市区町村）はスポット単位のカード
  return (
    <ContentEnter>
      {/*
        * #653（2026-10-02）: ここも `loading.tsx` と同じ骨組みにする。
        * 以前は共通の `ListScreenSkeleton` を使っていたが、本物（PostSearchScreen）と
        * 幅も中身もずれていて、届いた瞬間に画面が動いていた。
        */}
      <Suspense fallback={<PostSearchSkeleton />}>
        <StreamingSpotSearchScreen
          context={data.context}
          initialState={data.initialState}
          title={data.resolved.title}
          backHref="/"
          backLabel="ホーム"
          addMode={data.addMode}
          emptyMessage={data.resolved.kind === "not_found" ? "見つかりませんでした。都道府県名・駅名・スポット名で入力してください" : "条件に合う投稿がありません"}
          firstPage={firstPage}
        />
      </Suspense>
    </ContentEnter>
  );
}
