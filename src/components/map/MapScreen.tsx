"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
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
import { loadMapState, mapEntryFor, saveMapState, shouldRestoreMapState, type MapState } from "@/lib/map/map-state";
import type { TravelMode } from "@/lib/geo/travel-time";
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
 *   1. 左上の戻る（戻り先の画面名: 大阪府／大阪駅／スポット名／しおり／ホーム。map-navigation.ts・lib/map/back-label.ts。v3.1）
 *   2. 凡例（青＝みんなの投稿、赤＝保存済み、灰の破線＝下書き）
 *   3. 右下の「現在地」と「＋ ここに投稿」（現在地が取れていなければ地図の中心で投稿画面を開く）
 *   4. 探すモード（?mode=explore）のときだけ下 1/3 に「近くの声」
 * ピンは 1 回の API（/api/spots）で 3 種別まとめて取る。ピンをタップすると吹き出し（PinCallout）、
 * 長押しすると一時ピン＋「ここに投稿」。地図をタップ／ドラッグすると吹き出しと一時ピンは消える。
 * 吹き出しは「地図をそのピンの位置へ寄せてから、画面中央の少し上」に出す（マーカーに追従させるより単純で壊れにくい）。
 */
/**
 * Task3（2026-09-25）: 吹き出しが下 1/3 のカードに隠れないよう、地図の中心をピンより少し下にずらす量（度）。
 * 緯度 0.0007 度 ≒ 78m。ズーム 16 前後で画面のおよそ 1/8 にあたる
 */
const CALLOUT_OFFSET_DEGREES = 0.0007;

/** 近くのスポットのカードから、吹き出しに出すピンの形を作る（件数・星は一覧のピンから補う） */
function nearbyPinFrom(post: NearbyPost, pins: MapPinData[]): MapPinData {
  const known = pins.find((pin) => pin.spotId === post.spotId);
  if (known) return known;
  // 表示範囲の外などでピンがまだ取れていないときは、カードの情報だけで最低限の吹き出しを出す
  return {
    id: post.spotId,
    spotId: post.spotId,
    name: post.spotName,
    lat: post.lat,
    lng: post.lng,
    kind: "post",
    prefecture: null,
    postCount: 1,
    ratingAverage: null,
    latestStatus: null,
    draftId: null,
  };
}

export function MapScreen({
  open: openProp,
  fetchPins = defaultFetchPins,
  resolveCenter = () => resolveInitialCenter(typeof navigator === "undefined" ? undefined : navigator.geolocation),
  fetchNearby,
  itineraryApi,
  geolocation,
  notice,
  selfHref: selfHrefProp,
}: {
  open: MapOpenOptions;
  /** Bug #471: この地図の URL（吹き出し・近くのスポットから開く画面の戻り先）。無ければブラウザの URL を使う */
  selfHref?: string;
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

  // Bug #471: 吹き出し・近くのスポットのリンクに付ける「この地図の URL」。サーバーでは分からないので、
  // 描画後にブラウザの URL から取る（useSyncExternalStore はサーバーと最初の描画で第 3 引数の値を使い、その後ブラウザの値に置き換わる）
  const browserHref = useSyncExternalStore(
    () => () => {},
    () => `${window.location.pathname}${window.location.search}`,
    () => null
  );
  const selfHref = selfHrefProp ?? browserHref;

  // ── v3.1（mentoring-7 Task7）: 地図の状態の復元 ──
  // 同じ入口に戻ってきた（または素の /map で開いた）ときは、sessionStorage の直前の状態（中心・ズーム・モード・徒歩圏）で開く。
  // useState の初期化関数の中で 1 回だけ読む（描画のたびに読まない）
  const [restored] = useState<MapState | null>(() => {
    const entry = mapEntryFor(openProp);
    const saved = loadMapState();
    return shouldRestoreMapState(entry, saved, openProp.center) ? saved : null;
  });
  // 素の /map に戻ってきて直前が探すモードなら、探すモードのまま復元する（open を差し替える）
  const open: MapOpenOptions =
    restored && openProp.mode === "default" && restored.mode === "explore"
      ? { ...openProp, mode: "explore", center: restored.center, zoom: restored.zoom }
      : restored
        ? { ...openProp, center: restored.center, zoom: restored.zoom }
        : openProp;
  const entry = mapEntryFor(open);
  const travelRef = useRef<TravelMode | undefined>(restored?.travel ?? openProp.travel);
  // map-restore Task1（2026-09-25）: 選んでいたカードと、探すモードを「開いたとき」の現在地。
  // 開いたときの現在地は復元の判定に使う（今の中心はカードのスライドで動くので判定には使えない）。
  // 復元して開いたときは、その値を引き継いで上書きしない
  const activeSpotRef = useRef<string | null>(restored?.activeSpotId ?? null);
  const openedAtRef = useRef<{ lat: number; lng: number } | undefined>(restored?.openedAt ?? (openProp.mode === "explore" ? (openProp.center ?? undefined) : undefined));

  /** 今の地図の状態を保存する（中心は省略すると地図から読む） */
  const saveCurrentMapState = useCallback(
    (center?: LatLng) => {
      const zoom = mapRef.current?.getZoom();
      const nextCenter = center ?? mapRef.current?.getCenter();
      if (typeof zoom !== "number" || !nextCenter) return;
      saveMapState({
        entry,
        mode: open.mode,
        center: nextCenter,
        zoom,
        ...(travelRef.current !== undefined ? { travel: travelRef.current } : {}),
        ...(openedAtRef.current ? { openedAt: openedAtRef.current } : {}),
        ...(activeSpotRef.current ? { activeSpotId: activeSpotRef.current } : {}),
      });
    },
    [entry, open.mode]
  );

  const [initial, setInitial] = useState<InitialCenter | null>(
    open.center ? { center: open.center, zoom: open.zoom, source: open.mode === "explore" && !restored ? "current" : "fallback" } : null
  );
  const [pins, setPins] = useState<MapPinData[]>([]);
  // handleActiveNearby から最新のピンを読むための控え（依存を増やさないため ref に置く）
  const pinsRef = useRef<MapPinData[]>([]);
  useEffect(() => {
    pinsRef.current = pins;
  }, [pins]);
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const [center, setCenter] = useState<LatLng | null>(open.center);
  const [fetchFailed, setFetchFailed] = useState(false);
  const [callout, setCallout] = useState<CalloutTarget | null>(null);
  const [tempPin, setTempPin] = useState<LatLng | null>(null);
  // Bug #511: 「地図をどこに表示するか（open.center）」と「現在地はどこか」を分ける。
  // 復元して開くと open.center は保存した地図の中心（＝選んでいたスポット）になるので、それを現在地にすると
  // 現在地マーカーと「近くのスポット」の取得元がスポットへずれてしまう。現在地は openedAt（探すモードを
  // 開いたときの現在地。無ければ URL の lat/lng）を仮に置き、戻ってきたときに取り直す
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number; accuracy?: number } | null>(
    open.mode === "explore" ? (restored?.openedAt ?? openProp.center) : null
  );
  const [isLocating, setIsLocating] = useState(false);
  const [activeNearbySpotId, setActiveNearbySpotId] = useState<string | null>(null);
  const [nearbyPosts, setNearbyPosts] = useState<NearbyPost[]>([]);

  // ── しおりの地図（itinerary-map-and-post Task1）──
  const isItinerary = open.mode === "itinerary";
  // v3.1: 指定が無ければ ALL（全日を色分け）。日付なしは ALL にだけ出る
  const [itineraryDay, setItineraryDay] = useState<ItineraryMapDay>(open.itineraryDay === undefined ? ALL_DAYS : open.itineraryDay);
  // しおりが読めたら: 現在地を待たず最初のスポット（無ければ東京駅）で開き、期間未設定なら「日付なし」のタブにする
  const onItineraryLoaded = useCallback(
    (loaded: NonNullable<ReturnType<typeof useItineraryForMap>["itinerary"]>) => {
      const first = loaded.spots[0];
      setInitial((current) => current ?? { center: first ? { lat: first.lat, lng: first.lng } : TOKYO_STATION, zoom: 13, source: "fallback" });
      // 期間より大きい Day を指定されたら ALL に倒す
      setItineraryDay((current) => (current !== ALL_DAYS && current > loaded.dayCount ? ALL_DAYS : current));
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

  // Bug #511: 投稿一覧などから戻ってきたとき（復元）は、歩いて移動している可能性があるので現在地を取り直す。
  // 地図の表示位置は動かさない（見ていた画面のまま）。取れなければ仮の現在地のまま
  useEffect(() => {
    if (!restored || open.mode !== "explore") return;
    let cancelled = false;
    resolveCenter().then((result) => {
      if (cancelled || result.source !== "current") return;
      setCurrentLocation(result.center);
      openedAtRef.current = result.center;
    });
    return () => {
      cancelled = true;
    };
    // 開いた直後に 1 回だけ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 開き方に中心が無いときだけ現在地（→東京駅）を待つ
  useEffect(() => {
    if (initial || open.mode === "itinerary") return;
    let cancelled = false;
    resolveCenter().then((result) => {
      if (cancelled) return;
      setInitial(result);
      if (result.source === "current") setCurrentLocation(result.center);
      // map-restore Task1: 探すモードを「開いたときの現在地」を覚える（復元の判定に使う）。復元して開いたときは上書きしない
      if (open.mode === "explore" && !openedAtRef.current) openedAtRef.current = result.center;
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
    // v3.1: 落ち着く（idle）たびに状態を保存する。戻ってきたときの復元用
    saveCurrentMapState(nextCenter);
    // itineraryPins は fit の対象。ref 経由なので依存に入れる必要は無いが、最新の配列を使うために入れる
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itineraryPins, entry, open.mode]);

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

  // 探すモード: 中央のカードに対応するピンを強調し、そのカードも覚える（map-restore Task1）。
  // Task3（2026-09-25）: そのスポットの吹き出しも開く。吹き出しは下のカードに隠れないよう、
  // 地図の中心をピンより少し南（画面では下）に置いて、ピンと吹き出しを上半分に見せる
  const handleActiveNearby = useCallback((post: NearbyPost | null) => {
    setActiveNearbySpotId(post?.spotId ?? null);
    activeSpotRef.current = post?.spotId ?? null;
    if (post) {
      mapRef.current?.panTo({ lat: post.lat - CALLOUT_OFFSET_DEGREES, lng: post.lng });
      setTempPin(null);
      setCallout({ kind: "pin", pin: nearbyPinFrom(post, pinsRef.current) });
    } else {
      setCallout(null);
    }
    saveCurrentMapState();
    // saveCurrentMapState は ref だけを読むので依存に入れない
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
              <PinCallout target={callout} onClose={closeCallout} backHref={selfHref} />
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
          <NearbyVoices
            center={currentLocation ?? open.center}
            backHref={selfHref}
            fetchPosts={fetchNearby}
            onActiveChange={handleActiveNearby}
            onPostsLoaded={setNearbyPosts}
            initialMode={restored?.travel ?? openProp.travel}
            initialActiveSpotId={restored?.activeSpotId ?? null}
            onModeChange={(travel) => {
              // 移動手段は idle を待たずにその場で保存する（地図を動かさずに切り替えて離れることがある）
              travelRef.current = travel;
              saveCurrentMapState();
            }}
          />
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
