"use client";

import { useCallback, useRef } from "react";
import Link from "next/link";
import type { ItineraryDetail } from "@/lib/itineraries/get-itinerary";
import type { DayTab } from "@/components/itineraries/DayTabs";
import { GoogleMap, type GoogleMapHandle } from "./GoogleMap";
import { buildItineraryPins } from "./ItineraryMapOverlay";
import { TOKYO_STATION } from "./initial-center";

/**
 * mentoring-7 Task8（v3.1）: しおり詳細の上 1/3 に出す「見るだけの地図」（開いている Day の番号ピン）
 * 出典: docs/tasks/shared-ui/mentoring-7/08-itinerary-detail.md
 *       要件定義書 v3.1 3.11.6（「地図で見る」は上 1/3 に地図、下 2/3 に一覧。地図のタップで全画面）
 *
 * 【初心者向け】StaticSpotMap のしおり版。ピンは buildItineraryPins（開いている Day の訪問順の番号。ALL は Day の色分け）。
 * 最初の idle で全部のピンが収まるように fitBounds する。全体を覆うリンクで全画面の地図（/map?itinerary=&day=）へ。
 */
export function ItineraryStaticMap({ itinerary, day, className }: { itinerary: ItineraryDetail; day: DayTab; className?: string }) {
  const mapRef = useRef<GoogleMapHandle>(null);
  const pins = buildItineraryPins(itinerary, day);
  const first = pins[0];
  const fittedKeyRef = useRef<string | null>(null);
  const key = pins.map((pin) => pin.id).join(",");
  // 地図が落ち着いたら（ピンが変わっていれば）全部が収まる範囲にする
  const onBoundsChange = useCallback(() => {
    if (fittedKeyRef.current === key || !mapRef.current || pins.length === 0) return;
    fittedKeyRef.current = key;
    mapRef.current.fitBounds(pins.map((pin) => ({ lat: pin.lat, lng: pin.lng })));
  }, [key, pins]);
  const href = `/map?itinerary=${itinerary.id}&day=${day}`;

  return (
    <div className={`relative overflow-hidden ${className ?? ""}`} data-itinerary-static-map>
      <GoogleMap
        ref={mapRef}
        initialCenter={first ? { lat: first.lat, lng: first.lng } : TOKYO_STATION}
        initialZoom={13}
        pins={pins}
        cluster={false}
        interactive={false}
        onBoundsChange={onBoundsChange}
        className="h-full w-full"
      />
      <Link href={href} aria-label="しおりの地図を全画面で見る" className="absolute inset-0 z-10 block">
        <span className="absolute right-3 bottom-3 rounded-full bg-ink/80 px-2.5 py-1 text-[11px] font-medium text-white">タップで地図を全画面に</span>
      </Link>
    </div>
  );
}
