import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUserOrRedirect } from "@/lib/auth/require-user-or-redirect";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { SpotSearchScreen } from "@/components/posts/SpotSearchScreen";
import { SpotPostListScreen } from "@/components/posts/SpotPostListScreen";
import { loadSearchPage, type SearchPageQuery } from "@/lib/search/load-search-page";
import { resolveListBack } from "@/lib/search/list-state";

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

  const data = await loadSearchPage(createAdminClient(), user.id, query);
  if (data.kind === "spot_missing") notFound();
  if (data.kind === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app px-6">
        <ErrorNotice message={ERROR_MESSAGES.dbLoadFailure} retryable className="w-full max-w-[360px]" />
      </div>
    );
  }

  if (data.spot) {
    return (
      <SpotPostListScreen
        spot={data.spot}
        initialState={data.initialState}
        initialPage={data.initialPage}
        initialMediaPage={data.initialMediaPage}
        addMode={data.addMode}
        back={resolveListBack(typeof query.back === "string" ? query.back : null)}
      />
    );
  }

  // v3.1（mentoring-7 Task3）: 検索結果（都道府県・駅・市区町村）はスポット単位のカード
  return (
    <SpotSearchScreen
      context={data.context}
      initialState={data.initialState}
      initialPage={data.initialSpotPage}
      initialMediaPage={data.initialMediaPage}
      title={data.resolved.title}
      backHref="/"
      backLabel="ホーム"
      addMode={data.addMode}
      emptyMessage={data.resolved.kind === "not_found" ? "見つかりませんでした。都道府県名・駅名・スポット名で入力してください" : "条件に合う投稿がありません"}
    />
  );
}
