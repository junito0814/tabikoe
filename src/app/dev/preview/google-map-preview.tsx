"use client";

import { useRef, useState } from "react";
import { GoogleMap, type GoogleMapHandle, type GoogleMapPin } from "@/components/map/GoogleMap";
import { TOKYO_STATION } from "@/components/map/initial-center";

/** 東京駅周辺にサンプルピンを散らし、クラスタリングと3種別の描画を目視する */
const SAMPLE_PINS: GoogleMapPin[] = Array.from({ length: 30 }, (_, i) => ({
  id: `sample-${i}`,
  lat: TOKYO_STATION.lat + (Math.sin(i * 1.7) * 0.01) + (i % 5) * 0.001,
  lng: TOKYO_STATION.lng + (Math.cos(i * 1.3) * 0.01) + (i % 3) * 0.001,
  type: i % 7 === 0 ? "wishlist" : i % 5 === 0 ? "posted" : "normal",
  title: `サンプル ${i}`,
}));

export default function GoogleMapPreview() {
  const ref = useRef<GoogleMapHandle>(null);
  const [clicked, setClicked] = useState<string | null>(null);
  const [bounds, setBounds] = useState<string>("");

  return (
    <div className="flex flex-col gap-2">
      <GoogleMap
        ref={ref}
        initialCenter={TOKYO_STATION}
        initialZoom={13}
        pins={SAMPLE_PINS}
        onPinClick={setClicked}
        onBoundsChange={(b) => setBounds(`${b.south.toFixed(3)}〜${b.north.toFixed(3)}`)}
        className="h-[320px] w-full overflow-hidden rounded-lg"
      />
      <p className="text-[11px] text-[#9C9488]">
        クリック: {clicked ?? "—"} / 緯度範囲: {bounds || "—"}
      </p>
      <button
        type="button"
        onClick={() => ref.current?.panTo({ lat: 34.7024, lng: 135.4959 }, 14)}
        className="h-9 rounded-[8px] border border-[#E8E1D8] bg-white text-[12px] font-medium text-[#3D3A35]"
      >
        大阪駅へ panTo
      </button>
    </div>
  );
}
