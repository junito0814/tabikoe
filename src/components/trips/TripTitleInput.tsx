"use client";

import { useEffect, useId, useRef, useState } from "react";
import { graphemeLength } from "@/lib/text/grapheme-length";
import { MAX_TRIP_TITLE_LENGTH } from "@/lib/trips/constants";
import { fetchWithAuthRedirect, UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";

export interface TripSuggestion {
  id: string;
  title: string;
  /** v3.0: 由来。own＝自分の旅行、album＝参加中のアルバム、itinerary＝参加中のしおり */
  source?: "own" | "album" | "itinerary";
}

const SOURCE_LABELS: Record<NonNullable<TripSuggestion["source"]>, string> = {
  own: "",
  album: "アルバム",
  itinerary: "しおり",
};

async function fetchSuggestionsFromApi(query: string): Promise<TripSuggestion[]> {
  const response = await fetchWithAuthRedirect(`/api/trips?query=${encodeURIComponent(query)}`);
  if (!response.ok) {
    return [];
  }
  const data = (await response.json()) as { trips: TripSuggestion[] };
  return data.trips;
}

/**
 * F-PO-01 旅行タイトル Task4: 旅行タイトル入力UI（オートコンプリート付き）
 * 出典: docs/tasks/posts/trip-title/04-trip-title-input-ui.md
 *
 * 投稿作成画面（SC-03）へ組み込むためのコンポーネント。
 * 候補は本人が過去に作成した旅行タイトルと、本人が編集者・オーナーとして参加しているアルバムの旅行（GET /api/trips）。
 * 候補にない名称を入力した場合は新規の旅行として扱われる（解決はサーバー側のresolveTripId）。
 *
 * 【初心者向け】value / onChange を親（PostFormFields → PostComposeScreen）から受け取る「制御コンポーネント」。自分では値を持たない。
 * 候補の取得は 250ms の debounce、候補リストは外側クリックで閉じる（document への mousedown 監視）。
 * `role="combobox"` や aria-* は、読み上げソフトに「候補付きの入力欄」だと伝えるための属性。
 */
export function TripTitleInput({
  value,
  onChange,
  fetchSuggestions = fetchSuggestionsFromApi,
  layout = "stacked",
}: {
  value: string;
  onChange: (value: string) => void;
  /** 候補取得の差し替え口（単体テスト・開発用プレビューでモックを注入するため） */
  fetchSuggestions?: (query: string) => Promise<TripSuggestion[]>;
  /** v3.0（post-creation-v3 Task2）: "inline" はラベルと入力欄を横並びにする */
  layout?: "stacked" | "inline";
}) {
  const inputId = useId();
  const [suggestions, setSuggestions] = useState<TripSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  /*
   * loading-feedback Task 4-9（2026-10-02）: 直近で探し終えた言葉。
   *
   * 【初心者向け】候補が無言で遅れて出ていたので「探しています…」を出す。
   * あわせて、**入力を変えたら前の言葉の候補を残さない**（打ち替えたのに古い候補が
   * 並んでいると、関係ないアルバムを選んでしまう）。
   * 旗を立てるのではなく「探し終えた言葉」と見比べて導く（他の入力欄と同じやり方）。
   */
  const [searchedQuery, setSearchedQuery] = useState<string | null>(null);

  const length = graphemeLength(value);
  const isTooLong = length > MAX_TRIP_TITLE_LENGTH;
  const trimmedValue = value.trim();
  /** 探し終えた言葉がいまの入力と一致するときだけ候補を使う */
  const visibleSuggestions = searchedQuery === trimmedValue ? suggestions : [];
  const isSearching = searchedQuery !== trimmedValue;

  // 呼び出し元がインライン関数を渡しても効果の再実行を招かないようrefで受ける
  // （依存配列に入れると、毎レンダーで新しい関数参照→再取得→再レンダーの無限ループになる）
  const fetchSuggestionsRef = useRef(fetchSuggestions);
  useEffect(() => {
    fetchSuggestionsRef.current = fetchSuggestions;
  }, [fetchSuggestions]);

  useEffect(() => {
    // 入力のたびに叩かないよう、少し待ってから候補を取得する
    const timer = setTimeout(async () => {
      const asked = value.trim();
      try {
        setSuggestions(await fetchSuggestionsRef.current(asked));
      } catch (error) {
        if (error instanceof UnauthorizedError) return;
        setSuggestions([]);
      }
      // 成功・失敗どちらでも記録する（待ち表示が出たままにならないように）
      setSearchedQuery(asked);
    }, 250);

    return () => clearTimeout(timer);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isInline = layout === "inline";
  return (
    <div ref={containerRef} className={`relative w-full ${isInline ? "flex flex-wrap items-center gap-x-2 gap-y-1" : ""}`}>
      <label htmlFor={inputId} className={isInline ? "w-[84px] shrink-0 text-[12px] font-medium text-muted" : "mb-1.5 block text-[12px] font-medium text-muted"}>
        アルバム{isInline ? " *" : ""}
      </label>
      <input
        id={inputId}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        autoComplete="off"
        role="combobox"
        aria-expanded={isOpen && visibleSuggestions.length > 0}
        aria-controls={`${inputId}-suggestions`}
        placeholder={isInline ? "空なら「日常」に入ります" : undefined}
        className={`h-11 rounded-[10px] border border-line bg-surface px-3 text-[14px] text-ink focus:outline-none focus:ring-1 focus:ring-accent ${isInline ? "min-w-0 flex-1" : "w-full"}`}
      />

      {/*
        * Task 4-9: 探している間はそう言う。**開いているときだけ**出す
        * （閉じている入力欄の下に出すと、関係のない文字がちらつく）
        */}
      {isOpen && isSearching && (
        <p role="status" className="mt-1 text-[12px] text-muted">
          探しています…
        </p>
      )}

      {isOpen && visibleSuggestions.length > 0 && (
        <ul
          id={`${inputId}-suggestions`}
          role="listbox"
          className="absolute z-10 mt-1 w-full overflow-hidden rounded-[10px] border border-line bg-surface shadow-card"
        >
          {visibleSuggestions.map((suggestion) => (
            <li key={suggestion.id} role="option" aria-selected={suggestion.title === value}>
              <button
                type="button"
                onClick={() => {
                  onChange(suggestion.title);
                  setIsOpen(false);
                }}
                className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-[14px] text-ink hover:bg-tint"
              >
                <span className="min-w-0 truncate">{suggestion.title}</span>
                {suggestion.source && SOURCE_LABELS[suggestion.source] && (
                  <span className="shrink-0 rounded-full bg-tint px-2 py-0.5 text-[10px] text-muted">{SOURCE_LABELS[suggestion.source]}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className={`mt-1 flex items-center justify-between ${isInline ? "w-full pl-[92px]" : ""}`}>
        <span className={`text-[11px] ${isTooLong ? "text-saved" : "text-muted"}`}>
          {length} / {MAX_TRIP_TITLE_LENGTH}
        </span>
        {isTooLong && (
          <span className="text-[11px] text-saved">
            {MAX_TRIP_TITLE_LENGTH}文字以内で入力してください
          </span>
        )}
      </div>
    </div>
  );
}
