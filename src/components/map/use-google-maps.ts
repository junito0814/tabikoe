"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * Google Maps JavaScript APIのスクリプトを一度だけ読み込む。
 *
 * SC-19（スポット手動登録）で使うために追加したが、SC-02（全体マップ、F-MP-01）・
 * SC-12（マイマップ、F-RC-06）でも同じローダーを再利用する想定。
 * それらのストーリーはまだ未実装のため、共通コンポーネントは本ストーリーで先に用意する。
 *
 * 読み込み状態はReactの外側（スクリプトタグ）にあるため、モジュールレベルのストアとして
 * 保持しuseSyncExternalStoreで購読する。複数コンポーネントから同時に呼ばれても
 * スクリプトの挿入は1回で済む。
 */
const SCRIPT_ID = "google-maps-js-api";

type LoadState = "loading" | "ready" | "error";

let currentState: LoadState = "loading";
let hasStarted = false;
const listeners = new Set<() => void>();

function setLoadState(next: LoadState) {
  if (currentState === next) return;
  currentState = next;
  listeners.forEach((listener) => listener());
}

function startLoading() {
  if (hasStarted || typeof window === "undefined") return;
  hasStarted = true;

  if (window.google?.maps) {
    setLoadState("ready");
    return;
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    setLoadState("error");
    return;
  }

  const script = document.createElement("script");
  script.id = SCRIPT_ID;
  script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&language=ja&loading=async`;
  script.async = true;
  script.addEventListener("load", () => setLoadState("ready"));
  script.addEventListener("error", () => setLoadState("error"));
  document.head.appendChild(script);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useGoogleMaps(): LoadState {
  useEffect(() => {
    startLoading();
  }, []);

  return useSyncExternalStore(
    subscribe,
    () => currentState,
    () => "loading" as LoadState
  );
}
