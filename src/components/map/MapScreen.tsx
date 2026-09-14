"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import type { GeocodedPlace } from "@/lib/google/geocoding";
import { isSameBounds, type MapBounds, type MapPinData, type MapView } from "@/lib/map/get-map-pins";
import { GoogleMap, type GoogleMapHandle, type GoogleMapPin } from "./GoogleMap";
import { resolveInitialCenter, type InitialCenter, type LatLng } from "./initial-center";
import { resolveMapPinType } from "./pin-type";
import { PlaceSearchBar, PLACE_SEARCH_ZOOM } from "./PlaceSearchBar";

const TABS: { view: MapView; label: string }[] = [
  { view: "all", label: "全体" },
  { view: "wishlist", label: "行きたい" },
];

/** 地図の移動が連続する間はまとめて1回の取得にする */
const FETCH_DEBOUNCE_MS = 300;

export type FetchMapPins = (view: MapView, bounds: MapBounds) => Promise<MapPinData[]>;

/**
 * F-MP-01 Task3: 全体マップ画面（SC-02）
 * 出典: docs/tasks/map-search/map-display/03-map-screen-ui.md
 *
 * - 「全体」「行きたい」タブは排他（3.4.1）。切り替えると同じ範囲でピンを取り直す
 * - 初期表示位置は現在地、拒否時は東京駅周辺（resolveInitialCenter）
 * - ピンのタップで投稿カード一覧（SC-04、F-MP-03）へ遷移する
 * - 検索バー（F-MP-02）は地図の移動のみ。投稿の絞り込み（F-MP-04）は SC-04 側にあり、ここでは持たない
 */
export function MapScreen({
  initialView = "all",
  fetchPins = defaultFetchPins,
  resolveCenter = () =>
    resolveInitialCenter(typeof navigator === "undefined" ? undefined : navigator.geolocation),
  searchPlace,
  notice,
}: {
  initialView?: MapView;
  /** 差し替え口（単体テスト用） */
  fetchPins?: FetchMapPins;
  /** 差し替え口（単体テスト用） */
  resolveCenter?: () => Promise<InitialCenter>;
  /** 差し替え口（単体テスト用）。省略時は PlaceSearchBar の既定（/api/geocode） */
  searchPlace?: React.ComponentProps<typeof PlaceSearchBar>["searchPlace"];
  /** 投稿完了などのフラッシュ表示（Server Component から渡す） */
  notice?: ReactNode;
}) {
  const router = useRouter();
  const mapRef = useRef<GoogleMapHandle>(null);
  const [view, setView] = useState<MapView>(initialView);
  const [initial, setInitial] = useState<InitialCenter | null>(null);
  const [pins, setPins] = useState<MapPinData[]>([]);
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const [center, setCenter] = useState<LatLng | null>(null);
  const [fetchFailed, setFetchFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    resolveCenter().then((result) => {
      if (!cancelled) setInitial(result);
    });
    return () => {
      cancelled = true;
    };
  }, [resolveCenter]);

  // 範囲またはタブが変わったらピンを取り直す。古い応答が新しい状態を上書きしないよう世代で守る
  const requestIdRef = useRef(0);
  useEffect(() => {
    if (!bounds) return;
    const requestId = ++requestIdRef.current;
    const timer = setTimeout(() => {
      fetchPins(view, bounds)
        .then((result) => {
          if (requestIdRef.current !== requestId) return;
          setPins(result);
          setFetchFailed(false);
        })
        .catch((error) => {
          if (error instanceof UnauthorizedError) return;
          if (requestIdRef.current !== requestId) return;
          setFetchFailed(true);
        });
    }, FETCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [view, bounds, fetchPins]);

  // idle は地図が動いていなくても発火することがある（タイル読み込み完了など）。
  // 範囲が同じなら state を変えず、再取得・再描画の連鎖を起こさない
  const handleBoundsChange = useCallback((next: MapBounds, nextCenter: LatLng) => {
    setBounds((current) => (current && isSameBounds(current, next) ? current : next));
    setCenter((current) =>
      current && current.lat === nextCenter.lat && current.lng === nextCenter.lng ? current : nextCenter
    );
  }, []);

  const handlePinClick = useCallback(
    (spotId: string) => {
      router.push(`/spots/${spotId}`);
    },
    [router]
  );

  // F-MP-02 Task2: 検索結果の緯度経度へ地図を移動する（ピンの絞り込み状態には触れない）
  const handleLocate = useCallback((place: GeocodedPlace) => {
    mapRef.current?.panTo({ lat: place.lat, lng: place.lng }, PLACE_SEARCH_ZOOM);
  }, []);

  const mapPins = useMemo<GoogleMapPin[]>(
    () =>
      pins.map((pin) => ({
        id: pin.spotId,
        lat: pin.lat,
        lng: pin.lng,
        type: resolveMapPinType(view, pin),
        title: pin.name,
      })),
    [pins, view]
  );

  const searchHref = center
    ? `/search?lat=${center.lat.toFixed(5)}&lng=${center.lng.toFixed(5)}`
    : "/search";

  return (
    <div className="relative flex h-[calc(100dvh-60px)] flex-col bg-[#FBF6F0] md:h-dvh">
      {/* 上部：タブ＋検索バー（地図に重ねる） */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-2 p-3">
        <div
          role="tablist"
          aria-label="表示するピン"
          className="pointer-events-auto mx-auto flex w-full max-w-[420px] rounded-full border border-[#E8E1D8] bg-white p-1 shadow-[0_2px_16px_rgba(61,58,53,0.10)]"
        >
          {TABS.map((tab) => {
            const selected = tab.view === view;
            return (
              <button
                key={tab.view}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setView(tab.view)}
                className={`h-9 flex-1 rounded-full text-[13px] font-semibold transition-colors ${
                  selected ? "bg-[#C4703F] text-white" : "text-[#9C9488]"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        <PlaceSearchBar
          onLocate={handleLocate}
          searchPlace={searchPlace}
          className="pointer-events-auto mx-auto w-full max-w-[420px]"
        />
        {notice && <div className="pointer-events-auto mx-auto w-full max-w-[420px]">{notice}</div>}
        {fetchFailed && (
          <ErrorNotice
            message={ERROR_MESSAGES.dbLoadFailure}
            onRetry={() => setBounds((current) => (current ? { ...current } : current))}
            className="pointer-events-auto mx-auto w-full max-w-[420px]"
          />
        )}
      </div>

      {initial ? (
        <GoogleMap
          ref={mapRef}
          initialCenter={initial.center}
          initialZoom={initial.zoom}
          pins={mapPins}
          onPinClick={handlePinClick}
          onBoundsChange={handleBoundsChange}
          className="flex-1"
        />
      ) : (
        <div role="region" aria-label="地図" className="flex flex-1 items-center justify-center bg-[#E8E1D8]">
          <span className="text-[12px] text-[#9C9488]">現在地を確認しています…</span>
        </div>
      )}

      {/* 下部：投稿検索（F-MP-04）への導線。距離の基準に地図の中心を渡す */}
      <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center">
        <Link
          href={searchHref}
          className="pointer-events-auto flex h-10 items-center gap-1.5 rounded-full bg-[#3D3A35] px-4 text-[12px] font-semibold text-white shadow-[0_2px_16px_rgba(61,58,53,0.25)]"
        >
          投稿を検索
        </Link>
      </div>

      {view === "wishlist" && bounds && !fetchFailed && pins.length === 0 && (
        <p className="pointer-events-none absolute inset-x-0 bottom-16 z-10 text-center text-[12px] text-[#3D3A35]">
          この範囲に「行きたい」スポットはありません
        </p>
      )}
    </div>
  );
}

async function defaultFetchPins(view: MapView, bounds: MapBounds): Promise<MapPinData[]> {
  const params = new URLSearchParams({
    view,
    north: String(bounds.north),
    south: String(bounds.south),
    east: String(bounds.east),
    west: String(bounds.west),
  });
  const response = await fetchWithAuthRedirect(`/api/spots?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch pins: ${response.status}`);
  }
  const data = (await response.json()) as { pins: MapPinData[] };
  return data.pins;
}
