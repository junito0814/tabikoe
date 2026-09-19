"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import { requestCurrentPosition } from "@/lib/geo/use-current-position";
import { isSameBounds, type MapBounds, type MapPinData } from "@/lib/map/get-map-pins";
import { composeHref } from "@/lib/posts/compose-initial-state";
import type { NearbyPost } from "@/lib/posts/nearby-posts";
import { GoogleMap, type GoogleMapHandle, type GoogleMapPin } from "./GoogleMap";
import { resolveInitialCenter, TOKYO_STATION, type InitialCenter, type LatLng } from "./initial-center";
import { MapLegend } from "./MapLegend";
import type { MapOpenOptions } from "./map-navigation";
import { NearbyVoices, type FetchNearbyPosts } from "./NearbyVoices";
import { PinCallout, type CalloutTarget } from "./PinCallout";
import { ALL_DAYS, buildItineraryPins, ItineraryMapOverlay, useItineraryForMap, type ItineraryMapDay } from "./ItineraryMapOverlay";
import type { ItineraryApi } from "@/components/itineraries/itinerary-api";

/** 地図の移動が連続する間はまとめて1回の取得にする */
const FETCH_DEBOUNCE_MS = 300;
/** 長押しの一時ピンの ID */
const TEMP_PIN_ID = "temp";

export type FetchMapPins = (bounds: MapBounds) => Promise<MapPinData[]>;

/**
 * map-display-v3 Task2 / pin-interaction-v3 Task1〜3 / explore-mode Task2（v3.0）: 地図（SC-02）
 * 出典: docs/tasks/map-search/map-display-v3/02-map-screen-rebuild.md
 *       docs/tasks/map-search/pin-interaction-v3/01-pin-callout.md
 *       docs/tasks/map-search/pin-interaction-v3/02-long-press.md
 *       docs/tasks/browsing/explore-mode/02-explore-mode-ui.md
 *       要件定義書 v3.0 3.4.1・3.4.4・3.4.5
 *
 * 【初心者向け】v1 のタブ（全体／行きたい）と地名検索バーは無くなり、置くのは 4 つだけ:
 *   1. 左上の戻る（?spot= なら「一覧に戻る」、?itinerary= なら「しおりに戻る」、それ以外「ホーム」。map-navigation.ts）
 *   2. 凡例（青＝みんなの投稿、赤＝保存済み、灰の破線＝下書き）
 *   3. 右下の「現在地」と「＋ ここに投稿」（現在地が取れていなければ地図の中心で投稿画面を開く）
 *   4. 探すモード（?mode=explore）のときだけ下 1/3 に「近くの声」
 * ピンは 1 回の API（/api/spots）で 3 種別まとめて取る。ピンをタップすると吹き出し（PinCallout）、
 * 長押しすると一時ピン＋「ここに投稿」。地図をタップ／ドラッグすると吹き出しと一時ピンは消える。
 * 吹き出しは「地図をそのピンの位置へ寄せてから、画面中央の少し上」に出す（マーカーに追従させるより単純で壊れにくい）。
 */
export function MapScreen({
  open,
  fetchPins = defaultFetchPins,
  resolveCenter = () => resolveInitialCenter(typeof navigator === "undefined" ? undefined : navigator.geolocation),
  fetchNearby,
  itineraryApi,
  geolocation,
  notice,
}: {
  open: MapOpenOptions;
  /** 差し替え口（単体テスト用） */
  fetchPins?: FetchMapPins;
  /** 差し替え口（単体テスト用）。開き方に中心が無いときだけ使う */
  resolveCenter?: () => Promise<InitialCenter>;
  /** 差し替え口（単体テスト用） */
  fetchNearby?: FetchNearbyPosts;
  /** 差し替え口（単体テスト用）。しおりの地図（?itinerary=）で使う */
  itineraryApi?: ItineraryApi;
  /** 差し替え口（単体テスト用） */
  geolocation?: Pick<Geolocation, "getCurrentPosition">;
  /** 投稿完了などのフラッシュ表示（Server Component から渡す） */
  notice?: ReactNode;
}) {
  const router = useRouter();
  const mapRef = useRef<GoogleMapHandle>(null);
  const [initial, setInitial] = useState<InitialCenter | null>(
    open.center ? { center: open.center, zoom: open.zoom, source: open.mode === "explore" ? "current" : "fallback" } : null
  );
  const [pins, setPins] = useState<MapPinData[]>([]);
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const [center, setCenter] = useState<LatLng | null>(open.center);
  const [fetchFailed, setFetchFailed] = useState(false);
  const [callout, setCallout] = useState<CalloutTarget | null>(null);
  const [tempPin, setTempPin] = useState<LatLng | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number; accuracy?: number } | null>(
    open.mode === "explore" && open.center ? open.center : null
  );
  const [isLocating, setIsLocating] = useState(false);
  const [activeNearbySpotId, setActiveNearbySpotId] = useState<string | null>(null);
  const [nearbyPosts, setNearbyPosts] = useState<NearbyPost[]>([]);

  // ── しおりの地図（itinerary-map-and-post Task1）──
  const isItinerary = open.mode === "itinerary";
  const [itineraryDay, setItineraryDay] = useState<ItineraryMapDay>(open.itineraryDay === undefined ? 1 : open.itineraryDay);
  // しおりが読めたら: 現在地を待たず最初のスポット（無ければ東京駅）で開き、期間未設定なら「日付なし」のタブにする
  const onItineraryLoaded = useCallback(
    (loaded: NonNullable<ReturnType<typeof useItineraryForMap>["itinerary"]>) => {
      const first = loaded.spots[0];
      setInitial((current) => current ?? { center: first ? { lat: first.lat, lng: first.lng } : TOKYO_STATION, zoom: 13, source: "fallback" });
      if (loaded.dayCount === 0) setItineraryDay((current) => (current === ALL_DAYS ? current : null));
    },
    []
  );
  const { itinerary, failed: itineraryFailed } = useItineraryForMap(isItinerary ? open.itineraryId : null, itineraryApi, onItineraryLoaded);
  const itineraryPins = useMemo(() => (itinerary ? buildItineraryPins(itinerary, itineraryDay) : []), [itinerary, itineraryDay]);
  // Day を切り替えるたび、そのピンが全部収まる範囲にする。地図がまだ無ければ最初の idle で行う（pendingFitRef）
  const fitKey = itineraryPins.map((pin) => pin.id).join(",");
  const pendingFitRef = useRef(false);
  useEffect(() => {
    if (!isItinerary || !fitKey) return;
    pendingFitRef.current = true;
    if (mapRef.current) {
      pendingFitRef.current = false;
      mapRef.current.fitBounds(itineraryPins.map((pin) => ({ lat: pin.lat, lng: pin.lng })));
    }
    // itineraryPins の中身は fitKey で判定する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isItinerary, fitKey]);

  // 開き方に中心が無いときだけ現在地（→東京駅）を待つ
  useEffect(() => {
    if (initial || open.mode === "itinerary") return;
    let cancelled = false;
    resolveCenter().then((result) => {
      if (cancelled) return;
      setInitial(result);
      if (result.source === "current") setCurrentLocation(result.center);
    });
    return () => {
      cancelled = true;
    };
  }, [initial, resolveCenter, open.mode]);

  // 範囲が変わったらピンを取り直す。古い応答が新しい状態を上書きしないよう世代で守る
  const requestIdRef = useRef(0);
  const focusedOnceRef = useRef(false);
  useEffect(() => {
    if (!bounds || isItinerary) return;
    const requestId = ++requestIdRef.current;
    const timer = setTimeout(() => {
      fetchPins(bounds)
        .then((result) => {
          if (requestIdRef.current !== requestId) return;
          setPins(result);
          setFetchFailed(false);
          // ?spot= で開いたとき、そのスポットのピンが取れたら吹き出しを出す（1 回だけ）
          if (!focusedOnceRef.current && open.focusSpotId) {
            const focused = result.find((item) => item.spotId === open.focusSpotId && item.kind !== "draft");
            if (focused) {
              focusedOnceRef.current = true;
              setCallout({ kind: "pin", pin: focused });
            }
          }
        })
        .catch((error) => {
          if (error instanceof UnauthorizedError) return;
          if (requestIdRef.current !== requestId) return;
          setFetchFailed(true);
        });
    }, FETCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [bounds, fetchPins, open.focusSpotId, isItinerary]);

  const handleBoundsChange = useCallback((next: MapBounds, nextCenter: LatLng) => {
    if (pendingFitRef.current && mapRef.current) {
      pendingFitRef.current = false;
      mapRef.current.fitBounds(itineraryPins.map((pin) => ({ lat: pin.lat, lng: pin.lng })));
    }
    setBounds((current) => (current && isSameBounds(current, next) ? current : next));
    setCenter((current) => (current && current.lat === nextCenter.lat && current.lng === nextCenter.lng ? current : nextCenter));
    // itineraryPins は fit の対象。ref 経由なので依存に入れる必要は無いが、最新の配列を使うために入れる
  }, [itineraryPins]);

  const closeCallout = useCallback(() => {
    setCallout(null);
    setTempPin(null);
  }, []);

  const handlePinClick = useCallback(
    (pinId: string) => {
      if (pinId === TEMP_PIN_ID) return;
      // しおりの番号ピン → しおり詳細のその行へ
      if (isItinerary && open.itineraryId) {
        const spot = itinerary?.spots.find((item) => item.spotId === pinId);
        const dayParam = spot ? (spot.dayIndex === null ? "undecided" : String(spot.dayIndex)) : null;
        router.push(`/itineraries/${open.itineraryId}?${dayParam ? `day=${dayParam}&` : ""}spot=${pinId}`);
        return;
      }
      const pin = pins.find((item) => item.id === pinId);
      if (!pin) return;
      setTempPin(null);
      mapRef.current?.panTo({ lat: pin.lat, lng: pin.lng });
      setCallout({ kind: "pin", pin });
    },
    [pins, isItinerary, open.itineraryId, itinerary, router]
  );

  const handleLongPress = useCallback((position: LatLng) => {
    setTempPin(position);
    mapRef.current?.panTo(position);
    setCallout({ kind: "temp", lat: position.lat, lng: position.lng });
  }, []);

  const locateMe = async () => {
    setIsLocating(true);
    try {
      const result = await requestCurrentPosition(geolocation ?? (typeof navigator === "undefined" ? undefined : navigator.geolocation));
      if (!result.ok) return;
      setCurrentLocation({ lat: result.lat, lng: result.lng });
      mapRef.current?.panTo({ lat: result.lat, lng: result.lng });
    } finally {
      setIsLocating(false);
    }
  };

  // 探すモード: 中央のカードに対応するピンを強調
  const handleActiveNearby = useCallback((post: NearbyPost | null) => {
    setActiveNearbySpotId(post?.spotId ?? null);
    if (post) mapRef.current?.panTo({ lat: post.lat, lng: post.lng });
  }, []);

  const mapPins = useMemo<GoogleMapPin[]>(() => {
    if (isItinerary) return itineraryPins;
    const focusId = open.mode === "explore" ? activeNearbySpotId : open.focusSpotId;
    // 行きたいの地図（wishlist-v3 Task2）は保存済みのピンだけ
    const visible = open.savedOnly ? pins.filter((pin) => pin.kind === "saved") : pins;
    const result: GoogleMapPin[] = visible.map((pin) => ({
      id: pin.id,
      lat: pin.lat,
      lng: pin.lng,
      type: pin.kind !== "draft" && pin.spotId === focusId ? "focus" : pin.kind,
      title: pin.name,
    }));
    // 探すモードで「近くのスポット」にあるスポットが範囲内のピンに無ければ（100 件上限など）補う
    if (open.mode === "explore") {
      const known = new Set(result.map((pin) => pin.id));
      for (const post of nearbyPosts) {
        if (known.has(post.spotId)) continue;
        known.add(post.spotId);
        result.push({ id: post.spotId, lat: post.lat, lng: post.lng, type: post.spotId === focusId ? "focus" : "post", title: post.spotName });
      }
    }
    if (tempPin) result.push({ id: TEMP_PIN_ID, lat: tempPin.lat, lng: tempPin.lng, type: "focus", title: "この地点" });
    return result;
  }, [pins, tempPin, open.mode, open.focusSpotId, open.savedOnly, activeNearbySpotId, nearbyPosts, isItinerary, itineraryPins]);

  const postHereHref = currentLocation
    ? composeHref({ kind: "current", lat: currentLocation.lat, lng: currentLocation.lng })
    : center
      ? composeHref({ kind: "location", lat: center.lat, lng: center.lng })
      : composeHref({ kind: "current" });

  const isExplore = open.mode === "explore";

  return (
    <div className={`relative flex flex-col bg-app ${open.savedOnly ? "h-[calc(100dvh-60px-88px)] md:h-[calc(100dvh-88px)]" : "h-[calc(100dvh-60px)] md:h-dvh"}`} data-map-mode={open.savedOnly ? "saved" : open.mode}>
      <div className={`relative ${isExplore ? "h-2/3" : "flex-1"}`}>
        {/* 上部：戻る＋凡例（地図に重ねる） */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-2 p-3">
          <div className="flex items-start gap-2">
            <Link
              href={open.back.href}
              className="pointer-events-auto inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-surface px-3 text-[12px] font-semibold text-ink shadow-card"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {open.back.label}
            </Link>
            {isItinerary && itinerary ? (
              <span className="pointer-events-auto ml-auto max-w-[45%] truncate rounded-full bg-surface px-3 py-1.5 text-[12px] font-bold text-ink shadow-card">{itinerary.title}</span>
            ) : (
              <MapLegend className="pointer-events-auto ml-auto" />
            )}
          </div>
          {isItinerary && itinerary && (
            <div className="flex flex-col gap-2">
              <ItineraryMapOverlay itinerary={itinerary} day={itineraryDay} onChange={setItineraryDay} />
              {itineraryDay === ALL_DAYS && <MapLegend mode="itinerary" dayCount={itinerary.dayCount} className="pointer-events-auto w-fit" />}
            </div>
          )}
          {isItinerary && itineraryFailed && <ErrorNotice message={ERROR_MESSAGES.dbLoadFailure} className="pointer-events-auto mx-auto w-full max-w-[420px]" />}
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
            onLongPress={handleLongPress}
            onMapClick={closeCallout}
            onDragStart={closeCallout}
            currentLocation={currentLocation}
            className="h-full"
          />
        ) : (
          <div role="region" aria-label="地図" className="flex h-full items-center justify-center bg-line">
            <span className="text-[12px] text-muted">現在地を確認しています…</span>
          </div>
        )}

        {/* 吹き出し: 地図をピンへ寄せてあるので、中央の少し上に出す */}
        {callout && (
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-[calc(100%+22px)]">
            <div className="pointer-events-auto">
              <PinCallout target={callout} onClose={closeCallout} />
            </div>
          </div>
        )}

        {/* 右下：現在地・ここに投稿 */}
        <div className="pointer-events-none absolute bottom-4 right-3 z-10 flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={() => void locateMe()}
            disabled={isLocating}
            aria-label="現在地"
            className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-surface text-ink shadow-card disabled:opacity-60"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="12" cy="12" r="1.8" fill="currentColor" />
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
          <Link
            href={postHereHref}
            className="pointer-events-auto flex h-11 items-center gap-1.5 rounded-full bg-accent px-4 text-[13px] font-bold text-white shadow-[0_4px_20px_rgba(47,127,216,0.30)]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
            ここに投稿
          </Link>
        </div>
      </div>

      {isExplore && open.center && (
        <div className="h-1/3 border-t border-line">
          <NearbyVoices center={open.center} fetchPosts={fetchNearby} onActiveChange={handleActiveNearby} onPostsLoaded={setNearbyPosts} />
        </div>
      )}
    </div>
  );
}

async function defaultFetchPins(bounds: MapBounds): Promise<MapPinData[]> {
  const params = new URLSearchParams({
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
