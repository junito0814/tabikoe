"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import type { RegisteredSpot } from "@/lib/spots/types";
import type { NearbySpot } from "@/lib/spots/nearby";
import { ManualSpotRegistrationModal } from "./ManualSpotRegistrationModal";

export interface SpotCandidate {
  /** 既に`spots`に存在する場合のみ入る。Google由来の未登録候補ではnull */
  id: string | null;
  name: string;
  lat: number;
  lng: number;
  source: "places" | "manual";
  postCount: number;
}

interface SearchResult {
  candidates: SpotCandidate[];
  placesUnavailable: boolean;
}

async function searchSpotsFromApi(query: string): Promise<SearchResult> {
  const response = await fetchWithAuthRedirect(
    `/api/spots/search?query=${encodeURIComponent(query)}`
  );
  if (!response.ok) {
    return { candidates: [], placesUnavailable: false };
  }
  return (await response.json()) as SearchResult;
}

/**
 * F-PO-01 スポット指定 Task3: スポット名オートコンプリートUI
 * 出典: docs/tasks/posts/spot-selection/03-spot-autocomplete-ui.md
 *
 * 候補にGoogle Places由来のものが含まれる場合、選択時にPOST /api/spotsで登録して
 * 採番されたIDを投稿に設定する（要件定義書3.3.5「手動登録スポットの共有」と同じく、
 * Places由来のスポットも登録して以降の候補に載せる）。
 * 候補が無い場合はSC-19（手動登録モーダル）への導線を出す。
 *
 * 【初心者向け】入力のたびに API を叩かないよう、300ms 入力が止まってから検索する（debounce。下の setTimeout）。
 * 候補は「登録済み（id あり）」と「Google 由来で未登録（id なし）」の 2 種類があり、後者は選んだ時点で
 * POST /api/spots で登録して id を作る。50m 以内に既存があるとサーバーが 409 で既存を返すので、それに寄せる。
 * v3.0 では SC-19 のモーダルは廃止され、この部品は「変更」ボタンの先で使われる。
 */
export function SpotAutocompleteInput({
  selectedSpot,
  onSelect,
  searchSpots = searchSpotsFromApi,
  manualRegistration = true,
  onCancel,
  autoFocus = false,
}: {
  selectedSpot: RegisteredSpot | null;
  onSelect: (spot: RegisteredSpot | null) => void;
  /** 検索の差し替え口（単体テスト・開発用プレビューでモックを注入するため） */
  searchSpots?: (query: string) => Promise<SearchResult>;
  /** v3.0（spot-selection-v3 Task4）: SC-03 では手動登録モーダルを使わない（地図のピンが手動登録を兼ねる） */
  manualRegistration?: boolean;
  /** 検索をやめて元の表示に戻す（SC-03 の「変更」の取消） */
  onCancel?: () => void;
  autoFocus?: boolean;
}) {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<SpotCandidate[]>([]);
  const [placesUnavailable, setPlacesUnavailable] = useState(false);
  /** 直近で検索を完了したクエリ。現在の入力と一致する時だけ結果を表示に使う */
  const [searchedQuery, setSearchedQuery] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const trimmedQuery = query.trim();
  const hasSearched = searchedQuery !== null && searchedQuery === trimmedQuery;
  const visibleCandidates = hasSearched ? candidates : [];

  // インライン関数を渡されても効果が再実行されないようrefで受ける
  const searchSpotsRef = useRef(searchSpots);
  useEffect(() => {
    searchSpotsRef.current = searchSpots;
  }, [searchSpots]);

  // debounce: 入力が変わるたびにタイマーを張り直し、300ms 止まったときだけ検索する。
  // cleanup（return の clearTimeout）が前回のタイマーを消すので、連続入力では最後の 1 回だけ走る
  useEffect(() => {
    if (trimmedQuery.length === 0) {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const result = await searchSpotsRef.current(trimmedQuery);
        setCandidates(result.candidates);
        setPlacesUnavailable(result.placesUnavailable);
      } catch (error) {
        if (error instanceof UnauthorizedError) return;
        setCandidates([]);
        setPlacesUnavailable(false);
      }
      setSearchedQuery(trimmedQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [trimmedQuery]);

  const handleSelectCandidate = async (candidate: SpotCandidate) => {
    setErrorMessage(null);

    // 既に登録済みのスポットはそのまま採用する
    if (candidate.id) {
      onSelect({
        id: candidate.id,
        name: candidate.name,
        lat: candidate.lat,
        lng: candidate.lng,
        prefecture: null,
        source: candidate.source,
      });
      setCandidates([]);
      return;
    }

    // Google Places由来の未登録候補は、登録してIDを採番してから投稿に紐づける
    try {
      const response = await fetchWithAuthRedirect("/api/spots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: candidate.name,
          lat: candidate.lat,
          lng: candidate.lng,
          source: "places",
        }),
      });

      // 半径50m以内に既存スポットがあれば、そちらを採用する
      if (response.status === 409) {
        const data = (await response.json()) as { existingSpot: NearbySpot };
        onSelect({
          id: data.existingSpot.id,
          name: data.existingSpot.name,
          lat: data.existingSpot.lat,
          lng: data.existingSpot.lng,
          prefecture: data.existingSpot.prefecture,
          source: data.existingSpot.source,
        });
        setCandidates([]);
        return;
      }

      if (!response.ok) {
        setErrorMessage("スポットを選択できませんでした。もう一度お試しください");
        return;
      }

      const data = (await response.json()) as { spot: RegisteredSpot };
      onSelect(data.spot);
      setCandidates([]);
    } catch (error) {
      if (error instanceof UnauthorizedError) return;
      setErrorMessage("スポットを選択できませんでした。もう一度お試しください");
    }
  };

  // 選択済みなら入力欄の代わりにスポット名と「変更」を出す（変更で null に戻して再検索）
  if (selectedSpot) {
    return (
      <div className="w-full">
        <span className="mb-1.5 block text-[12px] font-medium text-muted">スポット</span>
        <div className="flex items-center justify-between rounded-[10px] border border-line bg-surface px-3 py-2.5">
          <span className="text-[14px] text-ink">{selectedSpot.name}</span>
          <button
            type="button"
            onClick={() => {
              onSelect(null);
              setQuery("");
            }}
            className="text-[12px] font-medium text-accent underline underline-offset-2"
          >
            変更
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <label htmlFor={inputId} className="mb-1.5 block text-[12px] font-medium text-muted">
        スポット
      </label>
      <input
        id={inputId}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        autoComplete="off"
        autoFocus={autoFocus}
        placeholder="スポット名で探す"
        role="combobox"
        aria-expanded={visibleCandidates.length > 0}
        aria-controls={`${inputId}-candidates`}
        className="h-11 w-full rounded-[10px] border border-line bg-surface px-3 text-[14px] text-ink focus:outline-none focus:ring-1 focus:ring-accent"
      />

      {visibleCandidates.length > 0 && (
        <ul
          id={`${inputId}-candidates`}
          role="listbox"
          className="mt-1 overflow-hidden rounded-[10px] border border-line bg-surface"
        >
          {visibleCandidates.map((candidate) => (
            <li key={`${candidate.source}-${candidate.id ?? candidate.name}`} role="option" aria-selected={false}>
              <button
                type="button"
                onClick={() => handleSelectCandidate(candidate)}
                className="block w-full px-3 py-2.5 text-left text-[14px] text-ink hover:bg-tint"
              >
                {candidate.name}
              </button>
            </li>
          ))}
        </ul>
      )}

      {placesUnavailable && (
        <ErrorNotice className="mt-2" message={ERROR_MESSAGES.placeSearchFailure} />
      )}
      {errorMessage && <ErrorNotice className="mt-2" message={errorMessage} />}

      {hasSearched && visibleCandidates.length === 0 && manualRegistration && (
        <p className="mt-2 text-[12px] leading-[1.6] text-muted">
          候補が見つかりません。
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="font-medium text-accent underline underline-offset-2"
          >
            地図でスポットを登録する
          </button>
        </p>
      )}
      {hasSearched && visibleCandidates.length === 0 && !manualRegistration && (
        <p className="mt-2 text-[12px] leading-[1.6] text-muted">
          候補が見つかりません。地図でピンを合わせて「新しい場所」として投稿できます
        </p>
      )}
      {onCancel && (
        <button type="button" onClick={onCancel} className="mt-2 text-[12px] font-medium text-muted underline underline-offset-2">
          検索をやめる
        </button>
      )}

      {isModalOpen && manualRegistration && (
        <ManualSpotRegistrationModal
          initialName={query.trim()}
          onRegistered={(spot) => {
            onSelect(spot);
            setIsModalOpen(false);
          }}
          onSelectExisting={(spot) => {
            onSelect({
              id: spot.id,
              name: spot.name,
              lat: spot.lat,
              lng: spot.lng,
              prefecture: spot.prefecture,
              source: spot.source,
            });
            setIsModalOpen(false);
          }}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
}
