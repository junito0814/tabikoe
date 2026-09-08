"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useGoogleMaps } from "@/components/map/use-google-maps";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import type { NearbySpot } from "@/lib/spots/nearby";
import type { RegisteredSpot } from "@/lib/spots/types";

/** 現在地を取得できなかった場合の初期表示位置（東京駅） */
const FALLBACK_CENTER = { lat: 35.681236, lng: 139.767125 };
const DEFAULT_ZOOM = 17;

/**
 * F-PO-01 スポット指定 Task4: スポット手動登録画面（SC-19）
 * 出典: docs/tasks/posts/spot-selection/04-manual-spot-registration-ui.md
 *
 * SC-03から開くモーダル（独立URLは持たない）。
 * ピンは画面中央に固定し、地図側をドラッグして位置を合わせる「中央固定ピン」方式。
 * 確定時に地図中心の緯度経度をPOST /api/spotsへ送り、半径50m以内に既存スポットがあれば
 * 登録されず、その既存スポットの選択を促す（要件定義書3.3.5）。
 */
export function ManualSpotRegistrationModal({
  initialName,
  onRegistered,
  onSelectExisting,
  onClose,
}: {
  initialName: string;
  onRegistered: (spot: RegisteredSpot) => void;
  onSelectExisting: (spot: NearbySpot) => void;
  onClose: () => void;
}) {
  const mapsState = useGoogleMaps();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  const [name, setName] = useState(initialName);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [duplicateSpot, setDuplicateSpot] = useState<NearbySpot | null>(null);
  const [mapInitFailed, setMapInitFailed] = useState(false);

  const moveToCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((position) => {
      mapRef.current?.setCenter({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });
    });
  }, []);

  useEffect(() => {
    if (mapsState !== "ready" || !mapContainerRef.current || mapRef.current) {
      return;
    }

    try {
      mapRef.current = new google.maps.Map(mapContainerRef.current, {
        center: FALLBACK_CENTER,
        zoom: DEFAULT_ZOOM,
        disableDefaultUI: true,
        gestureHandling: "greedy",
      });
    } catch (error) {
      // 地図の生成自体に失敗した場合、何も描画されないまま無言になるのを避ける。
      // 失敗は一度きりで再レンダー後は上の早期returnに入るため、連鎖レンダーにはならない。
      console.error("Failed to initialise Google Map", error);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMapInitFailed(true);
      return;
    }

    // 現在地を初期表示にする（取得できない場合はFALLBACK_CENTERのまま）
    moveToCurrentLocation();
  }, [mapsState, moveToCurrentLocation]);

  const handleRegister = async () => {
    const center = mapRef.current?.getCenter();
    if (!center || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    setDuplicateSpot(null);

    try {
      const response = await fetchWithAuthRedirect("/api/spots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          lat: center.lat(),
          lng: center.lng(),
          source: "manual",
        }),
      });

      if (response.status === 409) {
        const data = (await response.json()) as { existingSpot: NearbySpot };
        setDuplicateSpot(data.existingSpot);
        return;
      }

      if (!response.ok) {
        setErrorMessage("スポットを登録できませんでした。入力内容をご確認ください");
        return;
      }

      const data = (await response.json()) as { spot: RegisteredSpot };
      onRegistered(data.spot);
    } catch (error) {
      if (error instanceof UnauthorizedError) return;
      setErrorMessage("スポットを登録できませんでした。入力内容をご確認ください");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="flex w-full max-w-[420px] flex-col gap-3 rounded-[14px] bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-[#3D3A35]">スポットを登録</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[13px] text-[#9C9488] underline underline-offset-2"
          >
            閉じる
          </button>
        </div>

        <label className="text-[12px] font-medium text-[#9C9488]">
          スポット名
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1.5 h-11 w-full rounded-[10px] border border-[#E8E1D8] px-3 text-[14px] text-[#3D3A35] focus:outline-none focus:ring-1 focus:ring-[#C4703F]"
          />
        </label>

        <div className="relative h-[260px] w-full overflow-hidden rounded-[10px] bg-[#E8E1D8]">
          {mapsState === "error" || mapInitFailed ? (
            <div className="flex h-full items-center justify-center p-4">
              <ErrorNotice message={ERROR_MESSAGES.mapLoadFailure} />
            </div>
          ) : (
            <>
              <div ref={mapContainerRef} className="h-full w-full" />
              {mapsState === "loading" && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[12px] text-[#9C9488]">地図を読み込んでいます…</span>
                </div>
              )}
              {/* 中央固定ピン。地図側を動かして位置を合わせる */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <svg width="32" height="40" viewBox="0 0 32 40" aria-hidden>
                  <path
                    d="M16 0C7.7 0 1 6.7 1 15c0 10.5 13.2 23.6 13.8 24.2a1.7 1.7 0 0 0 2.4 0C17.8 38.6 31 25.5 31 15 31 6.7 24.3 0 16 0z"
                    fill="#C4703F"
                  />
                  <circle cx="16" cy="15" r="5.5" fill="#fff" />
                </svg>
              </div>
              <button
                type="button"
                onClick={moveToCurrentLocation}
                className="absolute right-2 top-2 rounded-[8px] border border-[#E8E1D8] bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#3D3A35] shadow-sm"
              >
                現在地
              </button>
            </>
          )}
        </div>

        <p className="text-[11px] leading-[1.6] text-[#9C9488]">
          地図を動かして、中央のピンを登録したい位置に合わせてください
        </p>

        {duplicateSpot && (
          <div className="rounded-lg border border-[#E8E1D8] bg-[#FBF6F0] p-3">
            <p className="mb-2 text-[12px] leading-[1.6] text-[#3D3A35]">
              半径50m以内に「{duplicateSpot.name}」が登録済みです。こちらを使用してください。
            </p>
            <button
              type="button"
              onClick={() => onSelectExisting(duplicateSpot)}
              className="h-9 w-full rounded-[8px] bg-[#C4703F] text-[12px] font-semibold text-white"
            >
              このスポットを選択
            </button>
          </div>
        )}

        {errorMessage && <ErrorNotice message={errorMessage} />}

        <button
          type="button"
          onClick={handleRegister}
          disabled={isSubmitting || name.trim().length === 0 || mapsState !== "ready"}
          className="h-11 w-full rounded-[10px] bg-[#C4703F] text-[14px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
        >
          {isSubmitting ? "登録中..." : "この位置でスポットを登録"}
        </button>
      </div>
    </div>
  );
}
