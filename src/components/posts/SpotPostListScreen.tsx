"use client";

import Link from "next/link";
import { ReportLink } from "@/components/reports/ReportLink";
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
  isWishlisted: boolean;
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
      <p className="flex flex-wrap items-center gap-x-1.5 text-[12px] text-muted">
        {spot.isManualSpot && <span className="rounded-full bg-tint px-2 py-0.5 text-[10px] font-semibold text-accent">タビコエだけの場所</span>}
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
      <div className="flex flex-wrap items-center gap-2">
        <SaveButton
          spotId={spot.id}
          initialSaved={spot.isWishlisted}
          addMode={addMode ? { itineraryId: addMode.itineraryId, day: addMode.day, initialAdded: addMode.spotIds.includes(spot.id) } : null}
        />
        <Link
          href={composeHref({ kind: "spot", spotId: spot.id })}
          className="inline-flex h-9 items-center rounded-full bg-accent px-4 text-[12px] font-bold text-white"
        >
          投稿する
        </Link>
        <ReportLink targetType="spot" targetId={spot.id} returnTo={`/spots/${spot.id}`} />
      </div>
    </div>
  );

  // v3.1（mentoring-7 Task4）: 上 1/3 に見るだけの地図（タップで SC-02）、下 2/3 に一覧。「地図で見る」ボタンは置かない
  const mapHref = buildMapHrefWithBack({ spot: spot.id, lat: spot.lat, lng: spot.lng }, listHref);
  const map =
    spot.lat !== null && spot.lng !== null ? (
      <StaticSpotMap spot={{ id: spot.id, name: spot.name, lat: spot.lat, lng: spot.lng }} href={mapHref} className="h-full w-full" />
    ) : (
      <div className="flex h-full w-full items-center justify-center bg-line text-[12px] text-muted">位置情報のないスポット</div>
    );

  return (
    <MapSheetLayout map={map}>
      <PostSearchScreen
        context={context}
        initialState={initialState}
        initialPage={initialPage}
        initialMediaPage={initialMediaPage}
        title={spot.name}
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
