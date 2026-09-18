"use client";

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { PIN_MARKER_SIZE, pinIconDataUrl, type PinMarkerOptions } from "@/components/pins/pin-marker-icon";
import { getPinStyle, type AnyPinType } from "@/components/pins/pin-styles";
import { buildMapStyles, detectMapTheme, MAP_UI_OPTIONS, watchMapTheme, type MapTheme } from "./map-styles";
import type { MapBounds } from "@/lib/map/get-map-pins";
import { useGoogleMaps } from "./use-google-maps";
import type { LatLng } from "./initial-center";

/** 地図に置くピン。種別は shared-ui/pin-display-rules-v3 の種別（旧名 normal / wishlist も可） */
export interface GoogleMapPin extends PinMarkerOptions {
  id: string;
  lat: number;
  lng: number;
  type: AnyPinType;
  title?: string;
}

/** 親から地図を操作するためのハンドル（地名検索の移動など） */
export interface GoogleMapHandle {
  panTo: (center: LatLng, zoom?: number) => void;
  getCenter: () => LatLng | null;
}

/** 長押しと判定するまでの時間（ms）。要件定義書 v3.0 3.4.4 */
export const LONG_PRESS_MS = 500;

interface GoogleMapProps {
  initialCenter: LatLng;
  initialZoom: number;
  pins: GoogleMapPin[];
  onPinClick?: (pinId: string) => void;
  /** 地図の移動・ズームが落ち着いた（idle）時に呼ぶ。ピンの再取得に使う */
  onBoundsChange?: (bounds: MapBounds, center: LatLng) => void;
  /** 同一エリアにピンが集中する場合にまとめて表示する（要件3.4.1） */
  cluster?: boolean;
  /** 地図の長押し（タッチ 500ms／マウス右クリック）。pin-interaction-v3 Task2 */
  onLongPress?: (position: LatLng) => void;
  /** 地図のタップ（長押しの一時ピンを消す用途など） */
  onMapClick?: () => void;
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
 *
 * 【初心者向け】Google マップは React の管理外にある「外部ライブラリ」なので、次の順で扱う。
 *   1. useGoogleMaps() でスクリプトの読み込み状態を待つ（loading → ready）
 *   2. ready になったら useRef で確保した div に `new google.maps.Map(...)` で地図を 1 回だけ作る
 *   3. `pins` が変わったらマーカーを作り直す（前のマーカーは setMap(null) で消す）。クラスタは MarkerClusterer が担当
 *   4. 地図が動いて止まった（idle）ときに onBoundsChange で表示範囲を親に知らせ、親がピンを取り直す
 * `useImperativeHandle` は、親が ref 経由で `panTo` などを呼べるようにする仕組み。
 */
export function GoogleMap({
  initialCenter,
  initialZoom,
  pins,
  onPinClick,
  onBoundsChange,
  cluster = true,
  onLongPress,
  onMapClick,
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
  const onLongPressRef = useRef(onLongPress);
  const onMapClickRef = useRef(onMapClick);
  useEffect(() => {
    onPinClickRef.current = onPinClick;
    onBoundsChangeRef.current = onBoundsChange;
    onLongPressRef.current = onLongPress;
    onMapClickRef.current = onMapClick;
  }, [onPinClick, onBoundsChange, onLongPress, onMapClick]);

  // theme Task2: OS のダーク設定に合わせて地図のスタイルを切り替える（ズームで道路名の表示も変わる）
  const [theme, setTheme] = useState<MapTheme>(() => detectMapTheme());
  useEffect(() => watchMapTheme(setTheme), []);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mapsState !== "ready") return;
    map.setOptions({ styles: buildMapStyles(theme, map.getZoom() ?? initialZoom) });
    // 地図の再描画はマーカーにも影響するため、テーマが変わったらマーカーの色も作り直す（pinsSignature に theme を含める）
  }, [theme, mapsState, initialZoom]);

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
        ...MAP_UI_OPTIONS,
        zoomControl: true,
        gestureHandling: "greedy",
        styles: buildMapStyles(detectMapTheme(), initialZoom),
      });
    } catch (error) {
      console.error("Failed to initialise Google Map", error);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMapInitFailed(true);
      return;
    }
    mapRef.current = map;

    // 道路名はズーム 16 以上でだけ出す（表示情報の削減）
    let lastRoadVisible: boolean | null = null;
    map.addListener("zoom_changed", () => {
      const zoom = map.getZoom() ?? initialZoom;
      const roadVisible = zoom >= 16;
      if (roadVisible === lastRoadVisible) return;
      lastRoadVisible = roadVisible;
      map.setOptions({ styles: buildMapStyles(detectMapTheme(), zoom) });
    });

    // 長押し（タッチ）と右クリック（マウス）を同じ「長押し」として扱う。ドラッグ中は発火させない
    let pressTimer: ReturnType<typeof setTimeout> | null = null;
    const cancelPress = () => {
      if (pressTimer) clearTimeout(pressTimer);
      pressTimer = null;
    };
    map.addListener("mousedown", (event: google.maps.MapMouseEvent) => {
      cancelPress();
      const latLng = event.latLng;
      if (!latLng) return;
      pressTimer = setTimeout(() => {
        pressTimer = null;
        onLongPressRef.current?.({ lat: latLng.lat(), lng: latLng.lng() });
      }, LONG_PRESS_MS);
    });
    map.addListener("mouseup", cancelPress);
    map.addListener("dragstart", cancelPress);
    map.addListener("drag", cancelPress);
    map.addListener("contextmenu", (event: google.maps.MapMouseEvent) => {
      cancelPress();
      const latLng = event.latLng;
      if (latLng) onLongPressRef.current?.({ lat: latLng.lat(), lng: latLng.lng() });
    });
    map.addListener("click", () => {
      cancelPress();
      onMapClickRef.current?.();
    });

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

  // ピンの描画。親が毎レンダー新しい配列を渡しても、中身（id・座標・種別）が同じなら置き直さない
  // （置き直すたびにマーカーが消えて再描画され、点滅して見えるため）
  const pinsSignature =
    pins.map((pin) => `${pin.id}:${pin.lat}:${pin.lng}:${pin.type}:${pin.label ?? ""}:${pin.dayIndex ?? ""}:${pin.done ? 1 : 0}`).join("|") +
    `#${theme}`;
  const pinsRef = useRef(pins);
  useEffect(() => {
    pinsRef.current = pins;
  }, [pins]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mapsState !== "ready") return;

    clustererRef.current?.clearMarkers(true);
    markersRef.current.forEach((marker) => marker.setMap(null));

    const markers = pinsRef.current.map((pin) => {
      const marker = new google.maps.Marker({
        position: { lat: pin.lat, lng: pin.lng },
        title: pin.title ?? getPinStyle(pin.type).label,
        icon: {
          url: pinIconDataUrl(pin.type, { label: pin.label, dayIndex: pin.dayIndex, done: pin.done }),
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
    // pins の中身が変わった時だけ（配列の参照ではなく signature で判定）
  }, [pinsSignature, cluster, mapsState]);

  if (mapsState === "error" || mapInitFailed) {
    return (
      <div
        role="region"
        aria-label="地図"
        className={`flex items-center justify-center bg-line p-4 ${className ?? ""}`}
      >
        <ErrorNotice message={ERROR_MESSAGES.mapLoadFailure} retryable className="w-full max-w-[360px]" />
      </div>
    );
  }

  return (
    <div role="region" aria-label="地図" className={`relative bg-line ${className ?? ""}`}>
      <div ref={containerRef} className="h-full w-full" />
      {mapsState === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[12px] text-muted">地図を読み込んでいます…</span>
        </div>
      )}
    </div>
  );
}
