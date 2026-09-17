"use client";

import Link from "next/link";
import { ReportLink } from "@/components/reports/ReportLink";
import { SaveButton } from "@/components/save/SaveButton";
import { composeHref } from "@/lib/posts/compose-initial-state";
import type { PostCardPage } from "@/lib/posts/post-cards";
import type { SpotMediaPage } from "@/lib/posts/search-photos";
import { buildMapHrefWithBack } from "@/lib/search/list-state";
import { formatStatusLabel, type LatestSpotStatus } from "@/lib/spots/format-status-label";
import type { AddModeInfo } from "./AddModeBanner";
import { PostSearchScreen, type FetchSearchPage } from "./PostSearchScreen";
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
 *   2 行目: [地図で見る] (＋) [投稿する]（→ SC-03、スポット確定で開く）
 * 投稿が無ければ「まだ投稿がありません」。追加モード（?itinerary=）ならバナーが上に出る。
 * 「戻る」は地図へ（地図のピンやスポット名検索から来る画面のため）。
 */
export function SpotPostListScreen({
  spot,
  initialState,
  initialPage,
  initialMediaPage = null,
  addMode = null,
  fetchPage,
}: {
  spot: SpotSummary;
  initialState: PostSearchState;
  initialPage: PostCardPage;
  initialMediaPage?: { key: string; page: SpotMediaPage } | null;
  addMode?: AddModeInfo | null;
  /** 差し替え口（単体テスト用） */
  fetchPage?: FetchSearchPage;
}) {
  const context: SearchContext = {
    destination: { kind: "spot", spotId: spot.id },
    addMode: addMode ? { itinerary: addMode.itineraryId, day: addMode.day === null ? null : String(addMode.day) } : null,
  };
  const listHref = buildSearchPageHref(initialState, context);
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
        <Link
          href={buildMapHrefWithBack({ spot: spot.id, lat: spot.lat, lng: spot.lng }, listHref)}
          className="inline-flex h-9 items-center gap-1 rounded-full border border-line bg-surface px-3 text-[12px] font-semibold text-ink"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M12 21s-6-5.2-6-10a6 6 0 1 1 12 0c0 4.8-6 10-6 10z" stroke="currentColor" strokeWidth="1.8" />
            <circle cx="12" cy="11" r="2.2" fill="currentColor" />
          </svg>
          地図で見る
        </Link>
        <SaveButton spotId={spot.id} initialSaved={spot.isWishlisted} />
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

  return (
    <PostSearchScreen
      context={context}
      initialState={initialState}
      initialPage={initialPage}
      initialMediaPage={initialMediaPage}
      title={spot.name}
      backHref="/map"
      backLabel="地図"
      header={header}
      addMode={addMode}
      emptyMessage="まだ投稿がありません"
      fetchPage={fetchPage}
    />
  );
}
