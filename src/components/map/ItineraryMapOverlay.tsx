"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import type { ItineraryDetail } from "@/lib/itineraries/get-itinerary";
import { orderSpots } from "@/lib/itineraries/order-spots";
import { defaultItineraryApi, type ItineraryApi } from "@/components/itineraries/itinerary-api";
import { dayTabKeys, type DayKey } from "@/components/itineraries/DayTabs";
import type { GoogleMapPin } from "./GoogleMap";

/** 「すべて」を表すタブの値 */
export const ALL_DAYS = "all" as const;
export type ItineraryMapDay = DayKey | typeof ALL_DAYS;

/**
 * itinerary-map-and-post Task1: しおり表示の地図に重ねる Day タブと、番号ピンの組み立て
 * 出典: docs/tasks/itinerary/itinerary-map-and-post/01-itinerary-map.md
 *       要件定義書 v3.0 3.11.6
 *
 * 【初心者向け】しおりの地図は「開いている Day のスポットだけ」に訪問順の番号ピン（済みは灰色）を出す。
 * 「すべて」では全日を Day の色で色分け（番号は Day 内の順）。未定のスポットは番号なしの Day 色（灰）。
 * ピンの並び（番号）は lib/itineraries/order-spots.ts（時刻順→手動順）と同じ。
 * `buildItineraryPins` は純粋関数（単体テストの対象）。
 */
export function buildItineraryPins(itinerary: ItineraryDetail, day: ItineraryMapDay): GoogleMapPin[] {
  const days: DayKey[] = day === ALL_DAYS ? dayTabKeys(itinerary.dayCount) : [day];
  return days.flatMap((key) =>
    orderSpots(itinerary.spots.filter((spot) => spot.dayIndex === key)).map((spot, index) => ({
      id: spot.spotId,
      lat: spot.lat,
      lng: spot.lng,
      type: "numbered" as const,
      label: index + 1,
      dayIndex: key ?? 0,
      done: spot.checkedAt !== null,
      title: spot.name,
    }))
  );
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
  return { itinerary, failed };
}

export function ItineraryMapOverlay({ itinerary, day, onChange }: { itinerary: ItineraryDetail; day: ItineraryMapDay; onChange: (day: ItineraryMapDay) => void }) {
  const tabs = useMemo<{ key: ItineraryMapDay; label: string }[]>(
    () => [...dayTabKeys(itinerary.dayCount).map((key) => ({ key, label: key === null ? "未定" : `Day ${key}` })), { key: ALL_DAYS, label: "すべて" }],
    [itinerary.dayCount]
  );
  return (
    <div role="tablist" aria-label="Day" className="pointer-events-auto flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }} data-itinerary-map-tabs>
      {tabs.map((tab) => {
        const selected = tab.key === day;
        return (
          <button
            key={String(tab.key ?? "undecided")}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.key)}
            className={`h-8 shrink-0 rounded-full px-3 text-[12px] font-semibold shadow-card ${selected ? "bg-ink text-white" : "bg-surface text-muted"}`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
