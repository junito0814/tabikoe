"use client";

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { PIN_MARKER_SIZE, pinIconDataUrl } from "@/components/pins/pin-marker-icon";
import { PIN_STYLES, type PinType } from "@/components/pins/pin-styles";
import type { MapBounds } from "@/lib/map/get-map-pins";
import { useGoogleMaps } from "./use-google-maps";
import type { LatLng } from "./initial-center";

/** 地図に置くピン。種別は shared-ui/pin-display-rules の3種別 */
export interface GoogleMapPin {
  id: string;
  lat: number;
  lng: number;
  type: PinType;
  title?: string;
}

/** 親から地図を操作するためのハンドル（地名検索の移動など） */
export interface GoogleMapHandle {
  panTo: (center: LatLng, zoom?: number) => void;
  getCenter: () => LatLng | null;
}

interface GoogleMapProps {
  initialCenter: LatLng;
  initialZoom: number;
  pins: GoogleMapPin[];
  onPinClick?: (pinId: string) => void;
  /** 地図の移動・ズームが落ち着いた（idle）時に呼ぶ。ピンの再取得に使う */
  onBoundsChange?: (bounds: MapBounds, center: LatLng) => void;
  /** 同一エリアにピンが集中する場合にまとめて表示する（要件3.4.1） */
  cluster?: boolean;
  ref?: Ref<GoogleMapHandle>;
  className?: string;
}

/**
 * F-MP-01 Task3〜5: 共通地図コンポーネント（Google Maps JavaScript API組み込み）
 * 出典: docs/tasks/map-search/map-display/03-map-screen-ui.md
 *       docs/tasks/map-search/map-display/04-pin-type-integration.md
 *       docs/tasks/map-search/map-display/05-map-error-handling.md
 *
 * SC-02（全体マップ）のほか、マイマップ（SC-12、F-RC-06）でも同じコンポーネントを使う前提（7.6）。
 * SC-19（スポット手動登録）は中央固定ピン方式で構造が違うため、ローダー（use-google-maps）だけを共有している。
 *
 * ピンは shared-ui/pin-display-rules の PinIcon と同じ図形（pin-marker-icon）をマーカーのアイコンにする。
 * Maps API の読み込み失敗時は共通のエラー表示（「地図を読み込めませんでした」）を地図エリアに出す（6.1）。
 */
export function GoogleMap({
  initialCenter,
  initialZoom,
  pins,
  onPinClick,
  onBoundsChange,
  cluster = true,
  ref,
  className,
}: GoogleMapProps) {
  const mapsState = useGoogleMaps();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const [mapInitFailed, setMapInitFailed] = useState(false);

  // コールバックはrefで持ち、親が毎レンダー新しい関数を渡してもリスナーを張り直さない
  const onPinClickRef = useRef(onPinClick);
  const onBoundsChangeRef = useRef(onBoundsChange);
  useEffect(() => {
    onPinClickRef.current = onPinClick;
    onBoundsChangeRef.current = onBoundsChange;
  }, [onPinClick, onBoundsChange]);

  useImperativeHandle(ref, () => ({
    panTo: (center, zoom) => {
      const map = mapRef.current;
      if (!map) return;
      map.panTo(center);
      if (typeof zoom === "number") map.setZoom(zoom);
    },
    getCenter: () => {
      const center = mapRef.current?.getCenter();
      return center ? { lat: center.lat(), lng: center.lng() } : null;
    },
  }));

  // 地図の生成（一度だけ）
  useEffect(() => {
    if (mapsState !== "ready" || !containerRef.current || mapRef.current) {
      return;
    }

    let map: google.maps.Map;
    try {
      map = new google.maps.Map(containerRef.current, {
        center: initialCenter,
        zoom: initialZoom,
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: "greedy",
        clickableIcons: false,
      });
    } catch (error) {
      console.error("Failed to initialise Google Map", error);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMapInitFailed(true);
      return;
    }
    mapRef.current = map;

    map.addListener("idle", () => {
      const bounds = map.getBounds();
      const center = map.getCenter();
      if (!bounds || !center) return;
      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();
      onBoundsChangeRef.current?.(
        { north: ne.lat(), south: sw.lat(), east: ne.lng(), west: sw.lng() },
        { lat: center.lat(), lng: center.lng() }
      );
    });
    // 初期位置は生成時にだけ使う（以降の移動は panTo 経由）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapsState]);

  // ピンの描画（pins が変わるたびに置き直す）
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mapsState !== "ready") return;

    clustererRef.current?.clearMarkers();
    markersRef.current.forEach((marker) => marker.setMap(null));

    const markers = pins.map((pin) => {
      const marker = new google.maps.Marker({
        position: { lat: pin.lat, lng: pin.lng },
        title: pin.title ?? PIN_STYLES[pin.type].label,
        icon: {
          url: pinIconDataUrl(pin.type),
          scaledSize: new google.maps.Size(PIN_MARKER_SIZE, PIN_MARKER_SIZE),
          anchor: new google.maps.Point(PIN_MARKER_SIZE / 2, PIN_MARKER_SIZE / 2),
        },
      });
      marker.addListener("click", () => onPinClickRef.current?.(pin.id));
      return marker;
    });
    markersRef.current = markers;

    if (cluster) {
      if (!clustererRef.current) {
        clustererRef.current = new MarkerClusterer({ map, markers });
      } else {
        clustererRef.current.addMarkers(markers);
      }
    } else {
      markers.forEach((marker) => marker.setMap(map));
    }
  }, [pins, cluster, mapsState]);

  if (mapsState === "error" || mapInitFailed) {
    return (
      <div
        role="region"
        aria-label="地図"
        className={`flex items-center justify-center bg-[#E8E1D8] p-4 ${className ?? ""}`}
      >
        <ErrorNotice message={ERROR_MESSAGES.mapLoadFailure} retryable className="w-full max-w-[360px]" />
      </div>
    );
  }

  return (
    <div role="region" aria-label="地図" className={`relative bg-[#E8E1D8] ${className ?? ""}`}>
      <div ref={containerRef} className="h-full w-full" />
      {mapsState === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[12px] text-[#9C9488]">地図を読み込んでいます…</span>
        </div>
      )}
    </div>
  );
}
