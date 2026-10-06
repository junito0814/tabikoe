"use client";

import Link from "next/link";
import { buildReportHref } from "@/components/reports/report-href";
import { MoreMenu, MoreMenuItem } from "@/components/ui/MoreMenu";
import { SaveButton } from "@/components/save/SaveButton";
import { composeHref } from "@/lib/posts/compose-initial-state";
import type { PostCardPage } from "@/lib/posts/post-cards";
import type { SpotMediaPage } from "@/lib/posts/search-photos";
import { appendBackHref, buildMapHrefWithBack } from "@/lib/search/list-state";
import { formatStatusLabel, type LatestSpotStatus } from "@/lib/spots/format-status-label";
import type { AddModeInfo } from "./AddModeBanner";
import { PostSearchScreen, type FetchSearchPage } from "./PostSearchScreen";
import { MapSheetLayout } from "@/components/layout/MapSheetLayout";
import { StaticSpotMap } from "@/components/map/StaticSpotMap";
import { buildSearchPageHref, type PostSearchState, type SearchContext } from "./post-search-query";

export interface SpotSummary {
  id: string;
  name: string;
  prefecture: string | null;
  lat: number | null;
  lng: number | null;
  /** 手動登録スポット＝「タビコエだけの場所」 */
  isManualSpot: boolean;
  postCount: number;
  /** map-sheet Task2: 地図を広くした段階の 1 行に出す星の平均（4.5.6）。投稿が無ければ null */
  ratingAverage: number | null;
  /** #696: 「行きたい」か「しおり」のどちらかに入っているか（どちらでも ✓ を出す） */
  isSaved: boolean;
  latestStatus: LatestSpotStatus | null;
}

/**
 * post-timeline Task4（v3.0）: スポット別一覧の見出し
 * 出典: docs/tasks/map-search/post-timeline/04-spot-list-header-and-add-mode.md
 *       要件定義書 v3.0 3.4.2
 *
 * 【初心者向け】一覧本体は検索結果と同じ PostSearchScreen（行き先＝スポット）で、この部品は見出しだけを足す。
 *   1 行目: 都道府県 ・ 投稿 N 件 ・ 9月にまだあった（報告があるときだけ）
 *   2 行目: (＋) [投稿する]（→ SC-03、スポット確定で開く）。「地図で見る」は上 1/3 の地図が兼ねる（v3.1）
 * 投稿が無ければ「まだ投稿がありません」。追加モード（?itinerary=）ならバナーが上に出る。
 * 「戻る」は `back`（`?back=` から page.tsx が解決した戻り先）へ。無ければ地図へ（地図のピンから来た場合。Bug #469）。
 */
export function SpotPostListScreen({
  spot,
  initialState,
  initialPage,
  initialMediaPage = null,
  addMode = null,
  fetchPage,
  back = null,
  official = null,
}: {
  spot: SpotSummary;
  initialState: PostSearchState;
  initialPage: PostCardPage;
  initialMediaPage?: { key: string; page: SpotMediaPage } | null;
  addMode?: AddModeInfo | null;
  /** 差し替え口（単体テスト用） */
  fetchPage?: FetchSearchPage;
  /** Bug #469: 戻り先（検索結果など）。href は `?back=` の生の値、label は画面名。無ければ「地図」 */
  back?: { href: string; label: string } | null;
  /**
   * #701: Google の公式情報（営業時間・公式サイト）。
   *
   * 【初心者向け】中身は Server Component（`OfficialInfo`）で、**この画面では作れない**
   * （API の鍵をブラウザに渡さないため。要件 6.2）。page.tsx が描いたものを
   * そのまま置く「差し込み口」として受け取る。出すものが無ければ null が来る。
   */
  official?: React.ReactNode;
}) {
  const context: SearchContext = {
    destination: { kind: "spot", spotId: spot.id },
    addMode: addMode ? { itinerary: addMode.itineraryId, day: addMode.day === null ? null : String(addMode.day) } : null,
  };
  // Bug #471: 上の地図（SC-02）から戻るときも、この一覧の戻り先（検索結果など）を保ったまま戻れるように back を含める
  const listHref = appendBackHref(buildSearchPageHref(initialState, context), back?.href);
  const statusLabel = formatStatusLabel(spot.latestStatus);

  const header = (
    <div className="flex flex-col gap-2">
      <p className="flex flex-wrap items-center gap-x-1.5 text-[0.75rem] text-muted">
        <span>{spot.prefecture ?? "都道府県未設定"}</span>
        <span aria-hidden>・</span>
        <span>投稿 {spot.postCount} 件</span>
        {statusLabel && (
          <>
            <span aria-hidden>・</span>
            <span className="font-medium text-done">{statusLabel}</span>
          </>
        )}
      </p>
      {official}
      <div className="flex flex-wrap items-center gap-2">
        <SaveButton
          spotId={spot.id}
          initialSaved={spot.isSaved}
          addMode={addMode ? { itineraryId: addMode.itineraryId, day: addMode.day, initialAdded: addMode.spotIds.includes(spot.id) } : null}
        />
        <Link
          href={composeHref({ kind: "spot", spotId: spot.id })}
          className="inline-flex h-9 items-center rounded-full bg-accent px-4 text-[0.75rem] font-bold text-white"
        >
          投稿する
        </Link>
      </div>
    </div>
  );

  // v3.1（mentoring-7 Task4）: 上 1/3 に見るだけの地図（タップで SC-02）、下 2/3 に一覧。「地図で見る」ボタンは置かない
  const mapHref = buildMapHrefWithBack({ spot: spot.id, lat: spot.lat, lng: spot.lng }, listHref);
  const map =
    spot.lat !== null && spot.lng !== null ? (
      <StaticSpotMap spot={{ id: spot.id, name: spot.name, lat: spot.lat, lng: spot.lng }} href={mapHref} className="h-full w-full" />
    ) : (
      <div className="flex h-full w-full items-center justify-center bg-line text-[0.75rem] text-muted">位置情報のないスポット</div>
    );

  // map-sheet Task2: 地図を広くした段階でシートに出す 1 行（4.5.6）
  const summary = (
    <p className="flex items-center gap-x-2 px-4 pb-3 text-[0.8125rem] font-semibold text-ink" data-sheet-summary-line>
      <span className="truncate">{spot.name}</span>
      {spot.ratingAverage !== null && (
        <span className="flex shrink-0 items-center gap-1 font-normal text-muted" aria-label={`星${spot.ratingAverage}`}>
          <span className="text-star" aria-hidden>
            ★
          </span>
          <span>{spot.ratingAverage.toFixed(1)}</span>
        </span>
      )}
      <span className="shrink-0 font-normal text-muted">投稿 {spot.postCount} 件</span>
    </p>
  );

  return (
    <MapSheetLayout map={map} summary={summary}>
      <PostSearchScreen
        context={context}
        initialState={initialState}
        initialPage={initialPage}
        initialMediaPage={initialMediaPage}
        title={spot.name}
        /*
         * #770（2026-10-06）: 「通報する」は「＋」「投稿する」のすぐ隣に下線リンクで並んでいた。
         * 主役の操作と並べる重さのものではないので、右上の「⋯」の中へ（アルバム・しおりと同じ形）。
         */
        headerAction={
          <MoreMenu>
            <MoreMenuItem label="通報する" href={buildReportHref({ targetType: "spot", targetId: spot.id, returnTo: `/spots/${spot.id}` })} />
          </MoreMenu>
        }
        backHref={back?.href ?? "/map"}
        backLabel={back?.label ?? "地図"}
        backParam={back?.href ?? null}
        header={header}
        addMode={addMode}
        emptyMessage="まだ投稿がありません"
        fetchPage={fetchPage}
      />
    </MapSheetLayout>
  );
}
