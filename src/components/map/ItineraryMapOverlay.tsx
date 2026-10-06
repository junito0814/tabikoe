"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import type { ItineraryDetail } from "@/lib/itineraries/get-itinerary";
import { spotsInTab } from "@/lib/itineraries/spots-in-tab";
import { defaultItineraryApi, type ItineraryApi } from "@/components/itineraries/itinerary-api";
import { ALL_TAB, dayTabKeys, dayTabLabel, type DayTab } from "@/components/itineraries/DayTabs";
import type { GoogleMapPin } from "./GoogleMap";

/** 「すべて」を表すタブの値 */
export const ALL_DAYS = ALL_TAB;
export type ItineraryMapDay = DayTab;

/**
 * itinerary-map-and-post Task1: しおり表示の地図に重ねる Day タブと、番号ピンの組み立て
 * 出典: docs/tasks/itinerary/itinerary-map-and-post/01-itinerary-map.md
 *       要件定義書 v3.0 3.11.6
 *
 * 【初心者向け】しおりの地図は「開いている Day のスポットだけ」に訪問順の番号ピン（済みは灰色）を出す。
 * 「ALL」（左端。v3.1）では全日を Day の色で色分け（番号は Day 内の順）。日付なしのスポットは ALL にだけ、Day 色（灰）で出る。
 * ピンの並び（番号）は lib/itineraries/order-spots.ts（時刻順→手動順）と同じ。
 * `buildItineraryPins` は純粋関数（単体テストの対象）。
 */
export function buildItineraryPins(itinerary: ItineraryDetail, day: ItineraryMapDay): GoogleMapPin[] {
  // #763: 並べ方は spotsInTab 1 つに置いた。下のカードも同じものから作るので、ピンとカードがズレない
  return spotsInTab(itinerary, day).map(({ spot, day: key, number }) => ({
    id: spot.spotId,
    lat: spot.lat,
    lng: spot.lng,
    type: "numbered" as const,
    label: number,
    dayIndex: key ?? 0,
    done: spot.checkedAt !== null,
    title: spot.name,
  }));
}

export function useItineraryForMap(itineraryId: string | null, api: ItineraryApi = defaultItineraryApi, onLoaded?: (itinerary: ItineraryDetail) => void) {
  const [itinerary, setItinerary] = useState<ItineraryDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const onLoadedRef = useRef(onLoaded);
  useEffect(() => {
    onLoadedRef.current = onLoaded;
  }, [onLoaded]);
  useEffect(() => {
    if (!itineraryId) return;
    let cancelled = false;
    api
      .get(itineraryId)
      .then((data) => {
        if (cancelled) return;
        setItinerary(data.itinerary);
        onLoadedRef.current?.(data.itinerary);
      })
      .catch((error) => {
        if (cancelled || error instanceof UnauthorizedError) return;
        setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [itineraryId, api]);
  /*
   * loading-feedback Task 4-4（2026-10-02）: まだ取っている最中かどうか。
   *
   * 【初心者向け】しおりの地図は取得が終わるまで**ピンも Day タブも出ない**ので、
   * 無言のまま空の地図が出ていた。「しおりのスポットが消えた」と読めてしまう。
   * ここは新しい state を足さずに**持っている値から導ける**。
   * 「しおりの id が指定されていて、まだ中身が無く、失敗もしていない」＝取得中。
   */
  const isLoading = itineraryId !== null && itinerary === null && !failed;
  return { itinerary, failed, isLoading };
}

export function ItineraryMapOverlay({ itinerary, day, onChange }: { itinerary: ItineraryDetail; day: ItineraryMapDay; onChange: (day: ItineraryMapDay) => void }) {
  const tabs = useMemo<{ key: ItineraryMapDay; label: string }[]>(
    () => dayTabKeys(itinerary.dayCount).map((key) => ({ key, label: dayTabLabel(key) })),
    [itinerary.dayCount]
  );
  return (
    <div role="tablist" aria-label="Day" className="pointer-events-auto flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }} data-itinerary-map-tabs>
      {tabs.map((tab) => {
        const selected = tab.key === day;
        return (
          <button
            key={String(tab.key)}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.key)}
            className={`h-8 shrink-0 rounded-full px-3 text-[12px] font-semibold shadow-card ${selected ? "bg-ink text-on-ink" : "bg-surface text-muted"}`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
