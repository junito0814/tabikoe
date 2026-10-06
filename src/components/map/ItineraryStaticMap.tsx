"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import type { ItineraryDetail } from "@/lib/itineraries/get-itinerary";
import type { DayTab } from "@/components/itineraries/DayTabs";
import { GoogleMap, type GoogleMapHandle } from "./GoogleMap";
import { buildItineraryPins } from "./ItineraryMapOverlay";
import { TOKYO_STATION } from "./initial-center";
import { isSameView, type MapView } from "./static-map-view";
import type { LatLng } from "./initial-center";

/**
 * mentoring-7 Task8（v3.1）: しおり詳細の上 1/3 の地図（開いている Day の番号ピン）
 * map-sheet Task1（2026-09-26）: 2 本指で動かせるようにし、全画面への入口を右下のボタンだけにした
 * 出典: docs/tasks/shared-ui/mentoring-7/08-itinerary-detail.md
 *       docs/tasks/shared-ui/map-sheet/01-pinch-and-zoom-controls.md
 *       要件定義書 4.5.8
 *
 * 【初心者向け】StaticSpotMap のしおり版。違うのは初期表示の決め方で、
 * こちらは最初の idle で fitBounds（全部のピンが収まる範囲）を掛ける。
 * つまり「初期表示」は計算されるまで分からないので、fitBounds が落ち着いた次の idle の
 * 中心・ズームを覚えておき、「戻す」はそこへ帰る。
 */
export function ItineraryStaticMap({
  itinerary,
  day,
  className,
  onPinClick,
  selectedSpotId = null,
}: {
  itinerary: ItineraryDetail;
  day: DayTab;
  className?: string;
  /** #761: ピンを押したときに呼ぶ（親が一覧のその行へ飛ばす） */
  onPinClick?: (spotId: string) => void;
  /** #761: 今選んでいるスポット。そのピンだけ大きくする */
  selectedSpotId?: string | null;
}) {
  const mapRef = useRef<GoogleMapHandle>(null);
  // #761: ピンの id はスポットの id（buildItineraryPins が `spot.spotId` を入れている）
  const pins = buildItineraryPins(itinerary, day).map((pin) => (pin.id === selectedSpotId ? { ...pin, selected: true } : pin));
  const first = pins[0];
  const fittedKeyRef = useRef<string | null>(null);
  const key = pins.map((pin) => pin.id).join(",");
  // fitBounds のあとに落ち着いた表示を「初期表示」として覚える。Day を切り替えたら取り直す
  const initialRef = useRef<MapView | null>(null);
  const [moved, setMoved] = useState(false);

  const onBoundsChange = useCallback(
    (_bounds: unknown, center: LatLng) => {
      if (fittedKeyRef.current !== key && mapRef.current && pins.length > 0) {
        fittedKeyRef.current = key;
        initialRef.current = null;
        setMoved(false);
        mapRef.current.fitBounds(pins.map((pin) => ({ lat: pin.lat, lng: pin.lng })));
        return;
      }
      const zoom = mapRef.current?.getZoom();
      if (typeof zoom !== "number") return;
      if (!initialRef.current) {
        initialRef.current = { center, zoom };
        setMoved(false);
        return;
      }
      setMoved(!isSameView(initialRef.current, { center, zoom }));
    },
    [key, pins]
  );

  const reset = useCallback(() => {
    const initial = initialRef.current;
    if (!initial) return;
    mapRef.current?.panTo(initial.center, initial.zoom);
    setMoved(false);
  }, []);

  const href = `/map?itinerary=${itinerary.id}&day=${day}`;

  return (
    <div className={`relative overflow-hidden ${className ?? ""}`} data-itinerary-static-map>
      <GoogleMap
        ref={mapRef}
        initialCenter={first ? { lat: first.lat, lng: first.lng } : TOKYO_STATION}
        initialZoom={13}
        pins={pins}
        onPinClick={onPinClick}
        cluster={false}
        gesture="cooperative"
        onBoundsChange={onBoundsChange}
        className="h-full w-full"
      />
      {/* シート（MapSheetLayout）が地図の下端に 16px かぶさるので、その分（12 + 16 = 28px）上げて隠れないようにする */}
      <div className="absolute right-3 bottom-7 z-10 flex items-center gap-2">
        {moved && (
          <button
            type="button"
            onClick={reset}
            className="tap-target rounded-full bg-surface/90 px-2.5 py-1 text-[0.6875rem] font-medium text-ink shadow-[0_1px_4px_rgba(30,42,56,0.25)]"
          >
            戻す
          </button>
        )}
        <Link href={href} className="tap-target rounded-full bg-ink/80 px-2.5 py-1 text-[0.6875rem] font-medium text-on-ink">
          地図を全画面に
        </Link>
      </div>
    </div>
  );
}
