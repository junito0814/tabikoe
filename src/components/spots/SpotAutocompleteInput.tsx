"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ErrorNotice } from "@/components/notices/ErrorNotice";
import { ERROR_MESSAGES } from "@/components/notices/error-messages";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import type { RegisteredSpot } from "@/lib/spots/types";
import type { NearbySpot } from "@/lib/spots/nearby";
import { GoogleMapsAttribution } from "@/components/google/GoogleMapsAttribution";
import {
  ATTRIBUTION_SOURCE_LABELS,
  groupBySource,
  spotCandidateSource,
} from "@/lib/google/attribution-source";

export interface SpotCandidate {
  /** 既に`spots`に存在する場合のみ入る。Google由来の未登録候補ではnull */
  id: string | null;
  name: string;
  lat: number;
  lng: number;
  source: "places" | "manual";
  postCount: number;
  /** #700: Google の Place ID。保存してよい唯一の値（要件 6.2）。手動登録には無い */
  placeId: string | null;
}

interface SearchResult {
  candidates: SpotCandidate[];
  placesUnavailable: boolean;
}

async function searchSpotsFromApi(query: string): Promise<SearchResult> {
  // Bug #485: 候補検索は /api/spots/candidates（/api/spots/search は v3.1 からスポットカード用）
  const response = await fetchWithAuthRedirect(
    `/api/spots/candidates?query=${encodeURIComponent(query)}`
  );
  if (!response.ok) {
    return { candidates: [], placesUnavailable: false };
  }
  const data = (await response.json()) as Partial<SearchResult>;
  // 応答の形が想定と違っても画面が落ちないように、無ければ空として扱う
  return { candidates: Array.isArray(data.candidates) ? data.candidates : [], placesUnavailable: data.placesUnavailable === true };
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
  onCancel,
  onPickUnregistered,
  autoFocus = false,
}: {
  selectedSpot: RegisteredSpot | null;
  onSelect: (spot: RegisteredSpot | null) => void;
  /**
   * #700: Google 由来で未登録の候補を選んだときの受け取り口。
   * ここが渡されていれば**登録せずに**親へ渡す（親が確定の一手を出す）。
   */
  onPickUnregistered?: (candidate: SpotCandidate) => void;
  /** 検索の差し替え口（単体テスト・開発用プレビューでモックを注入するため） */
  searchSpots?: (query: string) => Promise<SearchResult>;
  /** v3.0（spot-selection-v3 Task4）: SC-03 では手動登録モーダルを使わない（地図のピンが手動登録を兼ねる） */
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  /*
   * loading-feedback Task 4-1（2026-10-02）: いま登録している候補の目印。
   *
   * 【初心者向け】ここだけは**実害があった**。未登録の候補を押すと `POST /api/spots` を
   * 呼ぶが、押せないようにしていなかったので、**続けて押すと同じスポットが 2 つ登録されうる**。
   * サーバーは 50m 以内に既存があれば 409 で返すが、2 本が**同時に**走ると
   * どちらも「既存なし」と判定しうる。だから画面側で止める。
   * null なら登録していない。文字が入っていれば、その候補を登録している。
   */
  const [registeringKey, setRegisteringKey] = useState<string | null>(null);

  const trimmedQuery = query.trim();
  const hasSearched = searchedQuery !== null && searchedQuery === trimmedQuery;
  const visibleCandidates = hasSearched ? candidates : [];
  /*
   * loading-feedback Task 4-9（2026-10-02）: 探している最中かどうか。
   *
   * 【初心者向け】`useState` で「探し中」の旗を持つと、効果（useEffect）の中で
   * 旗を立てることになり eslint（react-hooks/set-state-in-effect）に止められる。
   * 代わりに「探し終えた語」と「いまの入力」を見比べて**その場で導く**。
   * 入力が止まるのを 300ms 待っている間も `searchedQuery` は前の語のままなので、
   * 待ち時間もふくめて「探している」と出せる（招待のユーザー名検索と同じやり方）。
   */
  const isSearching = trimmedQuery.length > 0 && !hasSearched;

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

  /** 候補を見分ける文字。React の key と「いま登録している候補」の両方で使う */
  const candidateKey = (candidate: SpotCandidate) => `${candidate.source}-${candidate.id ?? candidate.name}`;

  const handleSelectCandidate = async (candidate: SpotCandidate) => {
    // 登録中は何も受け付けない（二重登録を止める最後の砦。見た目の disabled だけに頼らない）
    if (registeringKey !== null) return;
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

    /*
     * #700: 未登録の候補は、**ここでは登録しない**。
     *
     * 【初心者向け】前は選んだ瞬間に登録していたので、Google が返した名前と座標が
     * そのまま保存されていた（規約が禁じている形）。いまは親に渡し、
     * 利用者が地図のピンと名前を確認して「この位置で確定」を押してから登録する。
     */
    if (onPickUnregistered) {
      onPickUnregistered(candidate);
      setCandidates([]);
      return;
    }

    // 受け取り手がいない画面（開発用のプレビューなど）では、今までどおりその場で登録する
    setRegisteringKey(candidateKey(candidate));
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
    } finally {
      // 成功・失敗・途中で抜けたとき、どの道を通っても必ず降ろす（押せないままにしない）
      setRegisteringKey(null);
    }
  };

  // 選択済みなら入力欄の代わりにスポット名と「変更」を出す（変更で null に戻して再検索）
  if (selectedSpot) {
    return (
      <div className="w-full">
        <span className="mb-1.5 block text-[0.75rem] font-medium text-muted">スポット</span>
        <div className="flex items-center justify-between rounded-[10px] border border-line bg-surface px-3 py-2.5">
          <span className="text-[0.875rem] text-ink">{selectedSpot.name}</span>
          <button
            type="button"
            onClick={() => {
              onSelect(null);
              setQuery("");
            }}
            className="text-[0.75rem] font-medium text-accent underline underline-offset-2"
          >
            変更
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <label htmlFor={inputId} className="mb-1.5 block text-[0.75rem] font-medium text-muted">
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
        className="h-11 w-full rounded-[10px] border border-line bg-surface px-3 text-[0.875rem] text-ink focus:outline-none focus:ring-1 focus:ring-accent"
      />

      {/* Task 4-9: 探している間は「探しています…」。探し終わるまで「見つかりません」と言わない */}
      {isSearching && (
        <p role="status" className="mt-2 text-[0.75rem] text-muted">
          探しています…
        </p>
      )}

      {/*
        * #699: 出どころ（タビコエに登録済み／Google 由来で未登録）で分け、
        * Google の組の下に公式のロゴを置く（要件 6.2・規約の求め）。
        */}
      {visibleCandidates.length > 0 && (
        <div
          id={`${inputId}-candidates`}
          /* Task 4-1: 登録中は一覧ごと「処理中」と伝える（読み上げにも効く） */
          aria-busy={registeringKey !== null}
          className="mt-1 overflow-hidden rounded-[10px] border border-line bg-surface"
        >
          {groupBySource(visibleCandidates, spotCandidateSource).map((group, groupIndex) => (
            <section key={group.source} className={groupIndex > 0 ? "border-t border-line" : undefined}>
              <h3 className="px-3 pb-0.5 pt-2 text-[0.65625rem] font-bold text-muted">
                {ATTRIBUTION_SOURCE_LABELS[group.source]}
              </h3>
              <ul role="listbox" aria-label={ATTRIBUTION_SOURCE_LABELS[group.source]}>
                {group.items.map((candidate) => {
                  const key = candidateKey(candidate);
                  const isRegistering = registeringKey === key;
                  return (
                    <li key={key} role="option" aria-selected={false}>
                      <button
                        type="button"
                        onClick={() => handleSelectCandidate(candidate)}
                        /* Task 4-1: どれか 1 つを登録している間は、一覧の**どの候補も**押せない */
                        disabled={registeringKey !== null}
                        className="block w-full px-3 py-2.5 text-left text-[0.875rem] text-ink hover:bg-tint disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {isRegistering ? "登録しています…" : candidate.name}
                      </button>
                    </li>
                  );
                })}
              </ul>
              {group.source === "google" && (
                <div className="px-3 pb-2 pt-0.5">
                  <GoogleMapsAttribution />
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      {placesUnavailable && (
        <ErrorNotice className="mt-2" message={ERROR_MESSAGES.placeSearchFailure} />
      )}
      {errorMessage && <ErrorNotice className="mt-2" message={errorMessage} />}

      {hasSearched && visibleCandidates.length === 0 && (
        <p className="mt-2 text-[0.75rem] leading-[1.6] text-muted">
          候補が見つかりません。地図でピンを合わせて「新しい場所」として投稿できます
        </p>
      )}
      {onCancel && (
        <button type="button" onClick={onCancel} className="mt-2 text-[0.75rem] font-medium text-muted underline underline-offset-2">
          検索をやめる
        </button>
      )}

    </div>
  );
}
