"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * Google Maps JavaScript APIを一度だけ読み込む。
 *
 * SC-19（スポット手動登録）で使うために追加したが、SC-02（全体マップ、F-MP-01）・
 * SC-12（マイマップ、F-RC-06）でも同じローダーを再利用する想定。
 * それらのストーリーはまだ未実装のため、共通コンポーネントは本ストーリーで先に用意する。
 *
 * 読み込み状態はReactの外側（スクリプトタグ）にあるため、モジュールレベルのストアとして
 * 保持しuseSyncExternalStoreで購読する。複数コンポーネントから同時に呼ばれても
 * スクリプトの挿入は1回で済む。
 *
 * 完了検知には`callback`パラメータを使う。maps/api/jsが返すのは
 * `google.maps.Load`・`google.maps.modules`だけを定義したローダーで、
 * `google.maps.Map`はここから非同期に読み込まれる本体が来るまで存在しない。
 * スクリプトタグのloadイベントではその完了を捉えられず、
 * このローダーは`importLibrary`も提供しないため、callbackで待つ必要がある。
 *
 * 【初心者向け】使い方は `const state = useGoogleMaps();` だけ。戻り値は "loading"／"ready"／"error" の 3 つで、
 * "ready" になってから `google.maps.*` を触る。API キーは NEXT_PUBLIC_GOOGLE_MAPS_API_KEY（表示専用・リファラー制限付き）。
 * 何度呼んでも <script> は 1 つしか挿入されない（hasStarted で防止）。
 */
const SCRIPT_ID = "google-maps-js-api";
const CALLBACK_NAME = "__tabikoeGoogleMapsReady";

/** 読み込みが返ってこない場合に、無言で待ち続けずエラーへ倒すまでの時間 */
const LOAD_TIMEOUT_MS = 15000;

type LoadState = "loading" | "ready" | "error";

declare global {
  interface Window {
    [CALLBACK_NAME]?: () => void;
  }
}

let currentState: LoadState = "loading";
let hasStarted = false;
const listeners = new Set<() => void>();

function setLoadState(next: LoadState) {
  if (currentState === next) return;
  currentState = next;
  listeners.forEach((listener) => listener());
}

function loadMapsApi(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Google Maps API load timed out")),
      LOAD_TIMEOUT_MS
    );

    window[CALLBACK_NAME] = () => {
      clearTimeout(timer);
      delete window[CALLBACK_NAME];
      resolve();
    };

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${apiKey}` +
      `&language=ja&loading=async&callback=${CALLBACK_NAME}`;
    script.async = true;
    script.addEventListener("error", () => {
      clearTimeout(timer);
      reject(new Error("Google Maps API script failed to load"));
    });
    document.head.appendChild(script);
  });
}

async function startLoading() {
  if (hasStarted || typeof window === "undefined") return;
  hasStarted = true;

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.error("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set");
    setLoadState("error");
    return;
  }

  try {
    if (typeof window.google?.maps?.Map !== "function") {
      await loadMapsApi(apiKey);
    }
    setLoadState("ready");
  } catch (error) {
    // 原因を追えるようにしておく（キー制限・API未有効化などはここに出る）
    console.error("Failed to load Google Maps API", error);
    setLoadState("error");
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useGoogleMaps(): LoadState {
  useEffect(() => {
    void startLoading();
  }, []);

  return useSyncExternalStore(
    subscribe,
    () => currentState,
    () => "loading" as LoadState
  );
}
