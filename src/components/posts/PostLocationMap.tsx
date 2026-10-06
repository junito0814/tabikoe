"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GoogleMap, type GoogleMapHandle } from "@/components/map/GoogleMap";
import { CURRENT_LOCATION_ZOOM, resolveInitialCenter, type LatLng } from "@/components/map/initial-center";
import type { MapBounds } from "@/lib/map/get-map-pins";

/** スポット固定時・位置決めのズーム（建物が見分けられる程度） */
export const LOCATION_PICK_ZOOM = 17;

/**
 * spot-selection-v3 Task1: 中央固定ピン地図（SC-03 の上 1/3）
 * 出典: docs/tasks/posts/spot-selection-v3/01-fixed-pin-map-component.md
 *       要件定義書 v3.0 3.3.5「地図（中央固定ピン）」
 *
 * 【初心者向け】v1 の手動登録モーダル（SC-19）の地図部分をここに切り出した。
 *   - ピンは地図の上に CSS で重ねた画像で、地図を動かすと「地図の中心＝ピンの位置」になる
 *   - `onCenterChange` で中心座標を親（PostComposeScreen）へ渡す。親は 300ms 待ってから
 *     /api/spots/resolve で「近くの登録済みスポット」を調べる
 *   - `lockedPosition` があるとき（既存スポットを選んでいるとき）はそこにピンを固定し、
 *     地図を動かしても位置は変わらない（ピンは地図上の実際の位置に描く）
 *   - `moved`（利用者が地図を動かしたか）を親に知らせる。自宅の保護の判定に使う（Task4）
 *   - 現在地ボタンで現在地へ戻せる。初回だけ案内文を出す
 */
export function PostLocationMap({
  initialCenter,
  lockedPosition,
  panTarget = null,
  onCenterChange,
  onMovedChange,
  onCurrentLocationResolved,
  resolveCenter = () => resolveInitialCenter(typeof navigator === "undefined" ? undefined : navigator.geolocation),
  className,
}: {
  /** null なら現在地を取得する（拒否時は東京駅周辺） */
  initialCenter: LatLng | null;
  /** 既存スポットを選んでいるときの固定位置 */
  lockedPosition: LatLng | null;
  /**
   * #738: ここへ寄せるだけ（固定はしない）。
   *
   * 【初心者向け】`lockedPosition` は「スポットが決まったので、もう動かさない」という意味。
   * 確定の一手（#700）は**まだ決まっていない状態**で地図だけ動かしたいので、別の受け口にした。
   * **値が変わったときだけ**寄せる ── 地図を動かすたびに来る中心を渡すと、寄せ続けてしまう。
   */
  panTarget?: LatLng | null;
  onCenterChange: (center: LatLng) => void;
  onMovedChange?: (moved: boolean) => void;
  /** 現在地の取得結果（fallback＝拒否）を親に知らせる */
  onCurrentLocationResolved?: (result: { center: LatLng; fromCurrentLocation: boolean }) => void;
  /** 差し替え口（単体テスト用） */
  resolveCenter?: () => Promise<{ center: LatLng; zoom: number; source: "current" | "fallback" }>;
  className?: string;
}) {
  const mapRef = useRef<GoogleMapHandle>(null);
  const [center, setCenter] = useState<LatLng | null>(initialCenter);
  const [resolvedFromCurrent, setResolvedFromCurrent] = useState<boolean | null>(null);
  const [showHint, setShowHint] = useState(true);
  const movedRef = useRef(false);
  const onCenterChangeRef = useRef(onCenterChange);
  const onMovedChangeRef = useRef(onMovedChange);
  const onCurrentLocationResolvedRef = useRef(onCurrentLocationResolved);
  useEffect(() => {
    onCenterChangeRef.current = onCenterChange;
    onMovedChangeRef.current = onMovedChange;
    onCurrentLocationResolvedRef.current = onCurrentLocationResolved;
  }, [onCenterChange, onMovedChange, onCurrentLocationResolved]);

  // 初期位置が無ければ現在地を取る
  useEffect(() => {
    if (initialCenter) return;
    let cancelled = false;
    resolveCenter().then((result) => {
      if (cancelled) return;
      setCenter(result.center);
      setResolvedFromCurrent(result.source === "current");
      onCurrentLocationResolvedRef.current?.({ center: result.center, fromCurrentLocation: result.source === "current" });
    });
    return () => {
      cancelled = true;
    };
  }, [initialCenter, resolveCenter]);

  // 地図が止まるたびに中心を親へ。最初の idle は「動かした」に数えない
  const firstIdleRef = useRef(true);
  const handleBoundsChange = useCallback(
    (_bounds: MapBounds, next: LatLng) => {
      onCenterChangeRef.current(next);
      if (firstIdleRef.current) {
        firstIdleRef.current = false;
        return;
      }
      if (!movedRef.current) {
        movedRef.current = true;
        setShowHint(false);
        onMovedChangeRef.current?.(true);
      }
    },
    []
  );

  const moveToCurrentLocation = () => {
    resolveCenter().then((result) => {
      mapRef.current?.panTo(result.center, LOCATION_PICK_ZOOM);
    });
  };

  // 既存スポットが選ばれたらそこへ寄せる（位置は固定される）
  useEffect(() => {
    if (lockedPosition) mapRef.current?.panTo(lockedPosition, LOCATION_PICK_ZOOM);
  }, [lockedPosition]);

  // #738: 確定を待っている候補の位置へ寄せる（固定はしない。中央のピンはそのまま動かせる）
  useEffect(() => {
    if (panTarget) mapRef.current?.panTo(panTarget, LOCATION_PICK_ZOOM);
  }, [panTarget]);

  const isFallback = resolvedFromCurrent === false && !initialCenter;

  return (
    <div className={`relative overflow-hidden bg-map-placeholder ${className ?? ""}`} data-post-location-map>
      {center ? (
        <GoogleMap
          ref={mapRef}
          initialCenter={center}
          initialZoom={initialCenter || resolvedFromCurrent ? LOCATION_PICK_ZOOM : CURRENT_LOCATION_ZOOM}
          pins={lockedPosition ? [{ id: "locked", lat: lockedPosition.lat, lng: lockedPosition.lng, type: "focus" }] : []}
          cluster={false}
          onBoundsChange={handleBoundsChange}
          className="h-full w-full"
        />
      ) : (
        <div role="region" aria-label="地図" className="flex h-full items-center justify-center">
          <span className="text-[0.75rem] text-muted">現在地を確認しています…</span>
        </div>
      )}

      {/* 中央固定ピン。既存スポット選択中は固定ピン（focus）を地図側に描くので隠す */}
      {!lockedPosition && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" data-center-pin>
          <svg width="32" height="40" viewBox="0 0 32 40" aria-hidden className="-translate-y-5">
            <path
              d="M16 0C7.7 0 1 6.7 1 15c0 10.5 13.2 23.6 13.8 24.2a1.7 1.7 0 0 0 2.4 0C17.8 38.6 31 25.5 31 15 31 6.7 24.3 0 16 0z"
              fill="var(--accent)"
            />
            <circle cx="16" cy="15" r="5.5" fill="var(--surface)" />
          </svg>
        </div>
      )}

      <button
        type="button"
        onClick={moveToCurrentLocation}
        aria-label="現在地に戻す"
        className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface shadow-card"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="12" cy="12" r="1.8" fill="currentColor" />
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>

      {/*
        * #782（2026-10-06）: 吹き出しを 1 つにまとめた。
        *
        * 【初心者向け】以前は 2 つ出していて、現在地が取れないときは
        * 「現在地が取れないため東京駅周辺を…」と「現地でなければ「変更」から場所を探せます」が
        * **重なって**読めませんでした。言うことは同じなので 1 文にします。
        */}
      {showHint && !lockedPosition && (
        <div className="pointer-events-none absolute left-1/2 top-3 flex max-w-[86%] -translate-x-1/2 flex-col items-center" data-map-hint>
          <span className="rounded-[14px] bg-ink/85 px-3 py-1.5 text-center text-[0.6875rem] leading-[1.6] text-surface">
            {isFallback
              ? "現在地が取れないので東京駅周辺を表示しています。地図を動かすか、「変更」で場所を探せます"
              : "地図を動かしてピンを合わせる。現地でなければ「変更」から探せます"}
          </span>
        </div>
      )}
    </div>
  );
}
