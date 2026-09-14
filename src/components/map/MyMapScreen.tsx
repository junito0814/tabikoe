"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import { isSameBounds, type MapBounds } from "@/lib/map/get-map-pins";
import type { MyMapMode, MyMapPin } from "@/lib/map/get-my-map-pins";
import { GoogleMap, type GoogleMapPin } from "./GoogleMap";
import { resolveInitialCenter, type InitialCenter } from "./initial-center";
import { myMapPinHref } from "./my-map-navigation";

const MODES: { mode: MyMapMode; label: string }[] = [
  { mode: "both", label: "両方" },
  { mode: "posted", label: "自分の投稿" },
  { mode: "wishlist", label: "行きたい" },
];

const FETCH_DEBOUNCE_MS = 300;

export type FetchMyMapPins = (mode: MyMapMode, bounds: MapBounds) => Promise<MyMapPin[]>;

/**
 * F-RC-06 Task2・Task3: マイマップ画面（SC-12）
 * 出典: docs/tasks/records/my-map/02-map-component-reuse-integration.md
 *       docs/tasks/records/my-map/03-pin-tap-navigation.md
 *
 * SC-02 と同じ GoogleMap を使い、取得条件（GET /api/users/me/map-spots）と種別だけ差し替える。
 * 投稿済み＝posted ピン、「行きたい」＝wishlist ピン（3.6.5、両方該当は posted）。
 */
export function MyMapScreen({
  initialMode = "both",
  fetchPins = defaultFetchPins,
  resolveCenter = () =>
    resolveInitialCenter(typeof navigator === "undefined" ? undefined : navigator.geolocation),
}: {
  initialMode?: MyMapMode;
  /** 差し替え口（単体テスト用） */
  fetchPins?: FetchMyMapPins;
  /** 差し替え口（単体テスト用） */
  resolveCenter?: () => Promise<InitialCenter>;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<MyMapMode>(initialMode);
  const [initial, setInitial] = useState<InitialCenter | null>(null);
  const [pins, setPins] = useState<MyMapPin[]>([]);
  const [bounds, setBounds] = useState<MapBounds | null>(null);
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

  const requestIdRef = useRef(0);
  useEffect(() => {
    if (!bounds) return;
    const requestId = ++requestIdRef.current;
    const timer = setTimeout(() => {
      fetchPins(mode, bounds)
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
  }, [mode, bounds, fetchPins]);

  // idle が連続しても範囲が同じなら state を変えない（MapScreen と同じ理由）
  const handleBoundsChange = useCallback((next: MapBounds) => {
    setBounds((current) => (current && isSameBounds(current, next) ? current : next));
  }, []);

  const pinById = new Map(pins.map((pin) => [pin.spotId, pin]));
  const handlePinClick = useCallback(
    (spotId: string) => {
      const pin = pinById.get(spotId);
      if (pin) router.push(myMapPinHref(pin));
    },
    // pins が変わるたびに Map を作り直すため、pins を依存にする
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router, pins]
  );

  const mapPins = useMemo<GoogleMapPin[]>(
    () => pins.map((pin) => ({ id: pin.spotId, lat: pin.lat, lng: pin.lng, type: pin.kind, title: pin.name })),
    [pins]
  );

  return (
    <div className="relative flex h-[calc(100dvh-60px)] flex-col bg-[#FBF6F0] md:h-dvh">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-2 p-3">
        <div className="pointer-events-auto mx-auto flex w-full max-w-[420px] items-center gap-2">
          <Link
            href="/mypage"
            className="flex h-9 shrink-0 items-center rounded-full border border-[#E8E1D8] bg-white px-3 text-[12px] font-semibold text-[#3D3A35] shadow-[0_2px_16px_rgba(61,58,53,0.10)]"
          >
            マイページ
          </Link>
          <div
            role="radiogroup"
            aria-label="表示するピン"
            className="flex flex-1 rounded-full border border-[#E8E1D8] bg-white p-1 shadow-[0_2px_16px_rgba(61,58,53,0.10)]"
          >
            {MODES.map((item) => {
              const selected = item.mode === mode;
              return (
                <button
                  key={item.mode}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setMode(item.mode)}
                  className={`h-8 flex-1 rounded-full text-[12px] font-semibold transition-colors ${
                    selected ? "bg-[#3D3A35] text-white" : "text-[#9C9488]"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
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

      {bounds && !fetchFailed && pins.length === 0 && (
        <p className="pointer-events-none absolute inset-x-0 bottom-6 z-10 text-center text-[12px] text-[#3D3A35]">
          この範囲に表示できるスポットはありません
        </p>
      )}
    </div>
  );
}

async function defaultFetchPins(mode: MyMapMode, bounds: MapBounds): Promise<MyMapPin[]> {
  const params = new URLSearchParams({
    mode,
    north: String(bounds.north),
    south: String(bounds.south),
    east: String(bounds.east),
    west: String(bounds.west),
  });
  const response = await fetchWithAuthRedirect(`/api/users/me/map-spots?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch my map pins: ${response.status}`);
  }
  const data = (await response.json()) as { pins: MyMapPin[] };
  return data.pins;
}
