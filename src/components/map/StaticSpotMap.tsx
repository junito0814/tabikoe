"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { GoogleMap, type GoogleMapHandle } from "./GoogleMap";
import { isSameView, type MapView } from "./static-map-view";
import type { LatLng } from "./initial-center";

/** 上部の地図の初期ズーム。「戻す」はここへ戻る */
const INITIAL_ZOOM = 15;

/**
 * mentoring-7 Task4（v3.1）: 上 1/3 の地図（スポット別一覧・投稿詳細）
 * map-sheet Task1（2026-09-26）: 2 本指で動かせるようにし、全画面への入口を右下のボタンだけにした
 * 出典: docs/tasks/shared-ui/mentoring-7/04-map-on-top.md
 *       docs/tasks/shared-ui/map-sheet/01-pinch-and-zoom-controls.md
 *       要件定義書 4.5.8「上部の地図の操作と拡大縮小ボタン」
 *
 * 【初心者向け】そのスポットのピン 1 本だけを置いた地図。
 * 前は地図全体がリンクで、触るとすぐ全画面の地図へ移っていた。今は
 *   - 2 本指で拡大・縮小・移動できる（`gesture="cooperative"`。1 本指のドラッグは画面の縦スクロールに使う）
 *   - 全画面への入口は右下の「地図を全画面に」ボタンだけ（2 本指の操作をタップと間違えないため）
 *   - 動かしたあとはその隣に「戻す」が出て、元の中心・ズームに帰れる
 * 拡大縮小ボタン（＋ −）は出さない（領域が狭いため。buildMapOptions が gesture を見て決める）。
 */
export function StaticSpotMap({ spot, href, className }: { spot: { id: string; name: string; lat: number; lng: number }; href: string; className?: string }) {
  const mapRef = useRef<GoogleMapHandle>(null);
  const initialRef = useRef<MapView>({ center: { lat: spot.lat, lng: spot.lng }, zoom: INITIAL_ZOOM });
  const [moved, setMoved] = useState(false);

  // 地図が落ち着く（idle）たびに、初期表示と同じかを見る。違えば「戻す」を出す
  const handleBoundsChange = useCallback((_bounds: unknown, center: LatLng) => {
    const zoom = mapRef.current?.getZoom() ?? initialRef.current.zoom;
    setMoved(!isSameView(initialRef.current, { center, zoom }));
  }, []);

  const reset = useCallback(() => {
    mapRef.current?.panTo(initialRef.current.center, initialRef.current.zoom);
    setMoved(false);
  }, []);

  return (
    <div className={`relative overflow-hidden ${className ?? ""}`} data-static-spot-map>
      <GoogleMap
        ref={mapRef}
        initialCenter={{ lat: spot.lat, lng: spot.lng }}
        initialZoom={INITIAL_ZOOM}
        pins={[{ id: spot.id, lat: spot.lat, lng: spot.lng, type: "focus", title: spot.name }]}
        cluster={false}
        gesture="cooperative"
        onBoundsChange={handleBoundsChange}
        className="h-full w-full"
      />
      {/* シート（MapSheetLayout）が地図の下端に 16px かぶさるので、その分（12 + 16 = 28px）上げて隠れないようにする */}
      <div className="absolute right-3 bottom-7 z-10 flex items-center gap-2">
        {moved && (
          <button
            type="button"
            onClick={reset}
            className="rounded-full bg-surface/90 px-2.5 py-1 text-[11px] font-medium text-ink shadow-[0_1px_4px_rgba(30,42,56,0.25)]"
          >
            戻す
          </button>
        )}
        <Link href={href} className="rounded-full bg-ink/80 px-2.5 py-1 text-[11px] font-medium text-on-ink">
          地図を全画面に
        </Link>
      </div>
    </div>
  );
}
