"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import { useCurrentPosition } from "@/lib/geo/use-current-position";
import { clearMapState } from "@/lib/map/map-state";
import { composeHref } from "@/lib/posts/compose-initial-state";
import { buildSearchHref, type AddModeParams } from "@/lib/search/build-search-href";
import type { DestinationSuggestion } from "@/lib/search/suggest-destinations";
import { outfit, lora } from "@/app/fonts";
import { DestinationInput } from "./DestinationInput";

export interface SearchTopApi {
  suggest: (query: string, sessionToken: string) => Promise<{ suggestions: DestinationSuggestion[]; placesUnavailable: boolean }>;
  geocode: (query: string) => Promise<{ lat: number; lng: number } | null>;
}

/**
 * search-top Task2〜4: 検索トップ（SC-00＝ホーム、ハブ）
 * 出典: docs/tasks/map-search/search-top/02-search-top-screen.md
 *       docs/tasks/map-search/search-top/03-submit-and-geocode.md
 *       docs/tasks/map-search/search-top/04-geolocation-hook.md
 *       要件定義書 v3.0 3.4.1
 *
 * 【初心者向け】ログイン後の着地点。置くのは 3 つだけ:
 *   1. 行き先の入力欄（候補 → 投稿一覧 /search へ）
 *   2. 「近くのスポットを探す」（位置情報 → 地図の探すモード /map?mode=explore）
 *   3. 「ここを投稿」（位置情報 → 現在地にピンが刺さった投稿画面 /posts/new?lat&lng&from=current）
 * 位置情報が拒否されたら、2 は入力欄にフォーカスして案内、3 は東京駅周辺で投稿画面を開く（地図を動かす案内は画面側）。
 * この画面だけ背景上部に空のグラデーション（bg-sky）を敷く。
 */
export function SearchTopScreen({
  api = defaultApi,
  addMode = null,
  geolocation,
}: {
  /** 差し替え口（単体テスト用） */
  api?: SearchTopApi;
  /** しおりの追加モードで開かれたとき（add-spots Task2）。決定後の一覧に引き継ぐ */
  addMode?: AddModeParams | null;
  /** 差し替え口（単体テスト用） */
  geolocation?: Pick<Geolocation, "getCurrentPosition">;
}) {
  const router = useRouter();
  const { locate, isLocating } = useCurrentPosition(geolocation);

  // map-restore Task3（2026-09-25）: ホーム（この画面）を開いたら、覚えている地図の状態を消す。
  // 【初心者向け】投稿一覧などから地図に戻ったときは前の続きを出すが、いったんホームに帰ったら
  // 「探すモードを新しく開く」扱いにして、現在地・徒歩・半径 1km の初期値に戻す（要件 3.4.3）
  useEffect(() => {
    clearMapState();
  }, []);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [focusInput, setFocusInput] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const goTo = (target: DestinationSuggestion) => {
    router.push(buildSearchHref(target, addMode));
  };

  // 候補に無い文字列で決定 → 座標化して周辺検索
  const submitFreeText = async (text: string) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const place = await api.geocode(text);
      if (!place) {
        setError("見つかりませんでした。都道府県名・駅名・スポット名で入力してください");
        return;
      }
      router.push(buildSearchHref({ kind: "coords", lat: place.lat, lng: place.lng, q: text }, addMode));
    } catch (caught) {
      if (caught instanceof UnauthorizedError) return;
      setError("場所を調べられませんでした。時間をおいてお試しください");
    } finally {
      setIsSubmitting(false);
    }
  };

  const exploreNearby = async () => {
    setNotice(null);
    const result = await locate();
    if (!result.ok) {
      setNotice("位置情報が使えないため、行き先を入力してください");
      setFocusInput((n) => n + 1);
      return;
    }
    router.push(`/map?mode=explore&lat=${result.lat}&lng=${result.lng}`);
  };

  const postHere = async () => {
    setNotice(null);
    const result = await locate();
    if (!result.ok) {
      // 拒否時は東京駅周辺で開く（案内は投稿画面側が出す）
      router.push(composeHref({ kind: "current" }));
      return;
    }
    router.push(composeHref({ kind: "current", lat: result.lat, lng: result.lng }));
  };

  return (
    <div className={`${outfit.className} bg-sky flex min-h-[calc(100dvh-60px)] flex-col items-center justify-center gap-7 px-6 md:min-h-dvh`} data-search-top>
      {addMode && (
        <p className="w-full max-w-[360px] rounded-[10px] bg-accent/10 px-3 py-2 text-center text-[12px] font-medium text-accent">
          しおりに追加するスポットの行き先を入力してください
        </p>
      )}
      <div className="flex flex-col items-center gap-3">
        <AppLogoIcon />
        <h1 className={`${lora.className} text-[24px] font-bold tracking-[2px] text-ink`}>タビコエ</h1>
      </div>

      <div className="flex w-full max-w-[360px] flex-col gap-3">
        <DestinationInput
          suggest={api.suggest}
          onSelect={goTo}
          onSubmitFreeText={(text) => void submitFreeText(text)}
          focusSignal={focusInput}
          disabled={isSubmitting}
        />
        {notice && (
          <p role="status" className="text-center text-[12px] text-accent">
            {notice}
          </p>
        )}
        {error && <ErrorNotice message={error} />}

        <button
          type="button"
          onClick={() => void exploreNearby()}
          disabled={isLocating}
          className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full border border-line bg-surface text-[15px] font-semibold text-ink disabled:opacity-60"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="1.8" />
            <circle cx="12" cy="12" r="1.8" fill="currentColor" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          近くのスポットを探す
        </button>
        <button
          type="button"
          onClick={() => void postHere()}
          disabled={isLocating}
          className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-accent text-[15px] font-bold text-white shadow-[0_4px_20px_rgba(47,127,216,0.30)] disabled:opacity-60"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
          ここを投稿
        </button>
      </div>

    </div>
  );
}

function AppLogoIcon() {
  return (
    <svg width="64" height="64" viewBox="0 0 72 72" fill="none" aria-hidden>
      <rect width="72" height="72" rx="20" fill="var(--accent)" />
      <circle cx="36" cy="28" r="10" fill="rgba(255,255,255,0.25)" />
      <circle cx="36" cy="28" r="5" fill="#FFFFFF" />
      <path d="M36 38C36 38 26 50 26 54" stroke="rgba(255,255,255,0.5)" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M36 38C36 38 46 50 46 54" stroke="rgba(255,255,255,0.5)" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M36 38L36 54" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

const defaultApi: SearchTopApi = {
  suggest: async (query, sessionToken) => {
    const response = await fetchWithAuthRedirect(`/api/geocode/suggest?q=${encodeURIComponent(query)}&session=${encodeURIComponent(sessionToken)}`);
    if (!response.ok) return { suggestions: [], placesUnavailable: false };
    return (await response.json()) as { suggestions: DestinationSuggestion[]; placesUnavailable: boolean };
  },
  geocode: async (query) => {
    const response = await fetchWithAuthRedirect(`/api/geocode?query=${encodeURIComponent(query)}`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error("geocode failed");
    const data = (await response.json()) as { place: { lat: number; lng: number } };
    return data.place;
  },
};
