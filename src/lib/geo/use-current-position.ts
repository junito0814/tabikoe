"use client";

import { useCallback, useState } from "react";

/**
 * search-top Task4: 位置情報の取得（共通フック）
 * 出典: docs/tasks/map-search/search-top/04-geolocation-hook.md
 *       要件定義書 v3.0 3.4.1・7.4
 *
 * 【初心者向け】`navigator.geolocation.getCurrentPosition` はコールバック形式で扱いにくいので、
 * Promise に包んで「成功なら座標、拒否・失敗なら理由」を返すフックにした。
 * 検索トップの「近くのスポットを探す」「いまいる場所に投稿する」がこれを使い、拒否されたときの案内を出し分ける。
 * タイムアウトは 10 秒（無言で待ち続けない）。
 */
export const GEOLOCATION_TIMEOUT_MS = 10000;

export type CurrentPositionResult =
  | { ok: true; lat: number; lng: number }
  | { ok: false; reason: "unsupported" | "denied" | "unavailable" | "timeout" };

export function requestCurrentPosition(geolocation: Pick<Geolocation, "getCurrentPosition"> | undefined): Promise<CurrentPositionResult> {
  if (!geolocation) return Promise.resolve({ ok: false, reason: "unsupported" });
  return new Promise((resolve) => {
    geolocation.getCurrentPosition(
      (position) => resolve({ ok: true, lat: position.coords.latitude, lng: position.coords.longitude }),
      (error) => {
        const reason: Extract<CurrentPositionResult, { ok: false }>["reason"] =
          error.code === 1 ? "denied" : error.code === 3 ? "timeout" : "unavailable";
        resolve({ ok: false, reason });
      },
      { timeout: GEOLOCATION_TIMEOUT_MS, maximumAge: 60000 }
    );
  });
}

export function useCurrentPosition(geolocation?: Pick<Geolocation, "getCurrentPosition">) {
  const [isLocating, setIsLocating] = useState(false);
  const locate = useCallback(async (): Promise<CurrentPositionResult> => {
    setIsLocating(true);
    try {
      return await requestCurrentPosition(geolocation ?? (typeof navigator === "undefined" ? undefined : navigator.geolocation));
    } finally {
      setIsLocating(false);
    }
  }, [geolocation]);
  return { locate, isLocating };
}
