"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { GoogleMap, type GoogleMapHandle } from "@/components/map/GoogleMap";
import { boundsOfPoints, rectCorners } from "@/lib/map/fit-bounds";
import { appendBackHref } from "@/lib/search/list-state";
import type { SpotCardData } from "@/lib/spots/search-spots";
import { scrollToCard } from "@/components/map/card-strip";

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

  /*
   * #876（2026-10-07）: ピンを押したとき、**そのカードまで送る**。
   *
   * 【初心者向け】この画面は探すモードと違って**吹き出しを出しません**（決定事項 71。
   * 吹き出しの代わりが下のカード）。ところがピンを押しても地図が寄るだけで、
   * **下のカードは画面の外のまま**でした。そのため「押しても何も起きない」ように見え、
   * 実機確認で「探すモードと動きが違う」と指摘されました。
   * カードまで送れば、押したことと出てきたものが繋がります。
   */
  const select = (spot: SpotCardData) => {
    setSelectedId(spot.id);
    mapRef.current?.panTo({ lat: spot.lat, lng: spot.lng }, SELECTED_ZOOM);
    const index = spots.findIndex((item) => item.id === spot.id);
    if (index >= 0) scrollToCard(stripRef.current, index);
  };

  /** カードを右端まで送ったら次を読む（一覧の無限スクロールと同じ考え方） */
  const onStripScroll = () => {
    const strip = stripRef.current;
    if (!strip || !hasMore || isLoading) return;
    const remaining = strip.scrollWidth - strip.scrollLeft - strip.clientWidth;
    if (remaining < 80) onLoadMore();
  };

  const first = spots[0];

  /*
   * 2026-10-05 の撮影で見つけて直したこと ── 最初はカードを地図に**重ねて**置いていたが、
   * **Google のロゴ（規約で必須の表記）を隠してしまっていた**。探すモードも重ねておらず
   * （上が地図、下がカード）、同じ形に揃えた。
   */
  return (
    <div className="-mx-4 flex h-[calc(100dvh-230px)] min-h-[380px] flex-col" data-search-map>
      <div className="min-h-0 flex-1">
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
          // #741: カテゴリで色と記号が決まる（渡していなかったので全部同じ色になっていた）
          category: spot.category,
        }))}
        onPinClick={(pinId) => {
          const spot = spots.find((item) => item.id === pinId);
          if (spot) select(spot);
        }}
        className="h-full w-full"
      />
      </div>

      {/* 下に横スクロールのカード（探すモードと同じ見せ方。地図には重ねない） */}
      <div
        ref={stripRef}
        onScroll={onStripScroll}
        className="flex shrink-0 snap-x snap-mandatory items-stretch gap-2 overflow-x-auto border-t border-line bg-app px-4 py-2"
        data-map-card-strip
      >
        {spots.map((spot) => (
          <article
            key={spot.id}
            data-map-card={spot.id}
            data-selected={spot.id === selectedId ? "true" : undefined}
            /* #876: 選んだカードがひと目で分かるよう、枠を太くする（色だけに頼らない） */
            className={`w-[min(260px,78vw)] shrink-0 snap-start rounded-[12px] bg-surface p-3 shadow-card ${
              spot.id === selectedId ? "border-2 border-accent" : "border border-line"
            }`}
          >
            <button type="button" onClick={() => select(spot)} className="block w-full text-left">
              <span className="block truncate text-[0.875rem] font-bold text-ink">{spot.name}</span>
              <span className="mt-0.5 flex items-center gap-2 text-[0.6875rem] text-muted">
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
              prefetch={false} /* #900: 切ったまま。地図の下に横並びになるカードで、流し見される（押される率が低い） */
              className="mt-1.5 inline-block text-[0.75rem] font-semibold text-accent"
            >
              投稿を見る
            </Link>
          </article>
        ))}
        {isLoading && <p className="self-center px-3 text-[0.75rem] text-muted">読み込み中…</p>}
      </div>
    </div>
  );
}
