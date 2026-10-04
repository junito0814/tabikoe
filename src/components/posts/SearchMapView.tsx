"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { GoogleMap, type GoogleMapHandle } from "@/components/map/GoogleMap";
import { boundsOfPoints, rectCorners } from "@/lib/map/fit-bounds";
import { appendBackHref } from "@/lib/search/list-state";
import type { SpotCardData } from "@/lib/spots/search-spots";

/**
 * #681: 検索結果の「地図」タブ
 * 出典: docs/tasks/map-search/post-timeline/07-search-map-tab.md
 *       要件定義書 3.4.2「地図タブ」・ワイヤーフレーム決定事項 71
 *
 * 【初心者向け】探すモード（3.4.6）と同じ形 ── **地図を全面に出し、下に横スクロールのカード**。
 * 違うのは「どのスポットを出すか」だけで、ここでは**検索結果のスポット**を出す。
 *
 * 気をつけていること。
 *   - 開いたときに**結果が全部入る範囲**へ 1 回だけ合わせる。**追加の通信はしない**
 *     （カードが持っている緯度経度を使う）
 *   - **以降は動かさない。** 続きを読んでピンが増えても、見ている場所は飛ばない
 *   - カードを選ぶと**そのピンが強調されて地図が寄る**
 *   - カードを右端まで送ったら次の 20 件を読む
 */
const SELECTED_ZOOM = 15;

export function SearchMapView({
  spots,
  backHref,
  hasMore,
  isLoading,
  onLoadMore,
}: {
  spots: SpotCardData[];
  /** カードから開いた先で「戻る」に使う */
  backHref: string;
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
}) {
  const mapRef = useRef<GoogleMapHandle>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** 範囲合わせは最初の 1 回だけ（続きを読んでも動かさない） */
  const fittedRef = useRef(false);
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (fittedRef.current || spots.length === 0) return;
    const rect = boundsOfPoints(spots.map((spot) => ({ lat: spot.lat, lng: spot.lng })));
    if (!rect) return;
    fittedRef.current = true;
    mapRef.current?.fitBounds(rectCorners(rect));
  }, [spots]);

  const select = (spot: SpotCardData) => {
    setSelectedId(spot.id);
    mapRef.current?.panTo({ lat: spot.lat, lng: spot.lng }, SELECTED_ZOOM);
  };

  /** カードを右端まで送ったら次を読む（一覧の無限スクロールと同じ考え方） */
  const onStripScroll = () => {
    const strip = stripRef.current;
    if (!strip || !hasMore || isLoading) return;
    const remaining = strip.scrollWidth - strip.scrollLeft - strip.clientWidth;
    if (remaining < 80) onLoadMore();
  };

  const first = spots[0];

  return (
    <div className="relative -mx-4 h-[calc(100dvh-220px)] min-h-[360px]" data-search-map>
      <GoogleMap
        ref={mapRef}
        initialCenter={first ? { lat: first.lat, lng: first.lng } : { lat: 35.681, lng: 139.767 }}
        initialZoom={12}
        pins={spots.map((spot) => ({
          id: spot.id,
          lat: spot.lat,
          lng: spot.lng,
          // 選んでいるものだけ見た目を変える（探すモードと同じ "focus"）
          type: spot.id === selectedId ? "focus" : "post",
          title: spot.name,
        }))}
        onPinClick={(pinId) => {
          const spot = spots.find((item) => item.id === pinId);
          if (spot) select(spot);
        }}
        className="h-full w-full"
      />

      {/* 下に横スクロールのカード（探すモードと同じ見せ方） */}
      <div
        ref={stripRef}
        onScroll={onStripScroll}
        className="absolute inset-x-0 bottom-0 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-3"
        data-map-card-strip
      >
        {spots.map((spot) => (
          <article
            key={spot.id}
            data-map-card={spot.id}
            data-selected={spot.id === selectedId ? "true" : undefined}
            className={`w-[min(260px,78vw)] shrink-0 snap-start rounded-[12px] border bg-surface p-3 shadow-card ${
              spot.id === selectedId ? "border-accent" : "border-line"
            }`}
          >
            <button type="button" onClick={() => select(spot)} className="block w-full text-left">
              <span className="block truncate text-[14px] font-bold text-ink">{spot.name}</span>
              <span className="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
                {spot.averageRating !== null && (
                  <span className="flex items-center gap-0.5" aria-label={`星${spot.averageRating}`}>
                    <span aria-hidden className="text-star">
                      ★
                    </span>
                    {spot.averageRating.toFixed(1)}
                  </span>
                )}
                <span>投稿 {spot.postCount} 件</span>
              </span>
            </button>
            <Link
              href={appendBackHref(`/spots/${spot.id}`, backHref)}
              prefetch={false}
              className="mt-1.5 inline-block text-[12px] font-semibold text-accent"
            >
              投稿を見る
            </Link>
          </article>
        ))}
        {isLoading && <p className="self-center px-3 text-[12px] text-muted">読み込み中…</p>}
      </div>
    </div>
  );
}
