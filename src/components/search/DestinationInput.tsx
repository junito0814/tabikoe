"use client";

import { useEffect, useId, useRef, useState } from "react";
import { UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import { SUGGESTION_KIND_LABELS, type DestinationSuggestion } from "@/lib/search/suggest-destinations";

const DEBOUNCE_MS = 300;

/**
 * search-top Task2: 行き先の入力欄（候補付き）
 * 出典: docs/tasks/map-search/search-top/02-search-top-screen.md
 *
 * 【初心者向け】入力が 300ms 止まったら候補 API を呼び、種別ラベル付きで最大 8 件出す。
 * Places の課金を「1 回の入力セッション」にまとめるため、セッショントークン（ランダムな文字列）を
 * この入力欄が開いている間は同じ値で送る（決定したら新しい値に変える）。
 * Enter で候補に無い文字列を決定したときは onSubmitFreeText（座標化して周辺検索）。
 */
export function DestinationInput({
  suggest,
  onSelect,
  onSubmitFreeText,
  focusSignal = 0,
  disabled = false,
}: {
  suggest: (query: string, sessionToken: string) => Promise<{ suggestions: DestinationSuggestion[]; placesUnavailable: boolean }>;
  onSelect: (suggestion: DestinationSuggestion) => void;
  onSubmitFreeText: (text: string) => void;
  /** 値が変わるたびに入力欄へフォーカスする（位置情報拒否時の案内用） */
  focusSignal?: number;
  disabled?: boolean;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<DestinationSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [sessionToken, setSessionToken] = useState(() => newSessionToken());
  /*
   * loading-feedback Task 4-9（2026-10-02）: 直近で探し終えた言葉。
   *
   * 【初心者向け】これが無いと 2 つ困ることがあった。
   *   1. 候補が無言で遅れて出る（何も起きていないように見える）
   *   2. **入力を変えても前の言葉の候補が残る。** その状態で Enter を押すと
   *      `suggestions[0]` が使われるので、**打ち替えた先とは違う場所へ飛ぶ**
   * 「探し終えた言葉」と「いまの入力」を見比べて、一致するときだけ候補を使う。
   */
  const [searchedQuery, setSearchedQuery] = useState<string | null>(null);
  const suggestRef = useRef(suggest);
  useEffect(() => {
    suggestRef.current = suggest;
  }, [suggest]);

  useEffect(() => {
    if (focusSignal > 0) inputRef.current?.focus();
  }, [focusSignal]);

  useEffect(() => {
    const trimmed = query.trim();
    // 空になったら候補を消す（同期の setState を避けるため、タイマー経由で行う）
    const timer = setTimeout(async () => {
      if (!trimmed) {
        setSuggestions([]);
        setSearchedQuery(trimmed);
        return;
      }
      try {
        const result = await suggestRef.current(trimmed, sessionToken);
        setSuggestions(result.suggestions);
        setIsOpen(true);
      } catch (error) {
        if (error instanceof UnauthorizedError) return;
        setSuggestions([]);
      }
      // 成功・失敗どちらでも「この言葉は探し終えた」と記録する（待ち表示が出たままにならないように）
      setSearchedQuery(trimmed);
    }, trimmed ? DEBOUNCE_MS : 0);
    return () => clearTimeout(timer);
  }, [query, sessionToken]);

  const trimmedQuery = query.trim();
  /** 探し終えた言葉がいまの入力と一致するときだけ候補を使う（前の言葉の候補を残さない） */
  const visibleSuggestions = searchedQuery === trimmedQuery ? suggestions : [];
  /** 探している最中か。300ms 待っている間も含む */
  const isSearching = trimmedQuery.length > 0 && searchedQuery !== trimmedQuery;

  const select = (suggestion: DestinationSuggestion) => {
    setIsOpen(false);
    setSessionToken(newSessionToken());
    onSelect(suggestion);
  };

  return (
    <div className="relative w-full">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!trimmedQuery || disabled) return;
          // 候補があればその先頭を、無ければ自由入力として扱う。
          // Task 4-9: 前の言葉の候補は使わない（打ち替えた先と違う場所へ飛ばないように）
          if (visibleSuggestions[0]) select(visibleSuggestions[0]);
          else onSubmitFreeText(trimmedQuery);
        }}
        className="flex h-[52px] w-full items-center gap-2 rounded-full border border-line bg-surface px-4 shadow-card"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0 text-muted">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
          <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <input
          id={inputId}
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => visibleSuggestions.length > 0 && setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 150)}
          placeholder="どこへ行く？"
          aria-label="行き先"
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen && visibleSuggestions.length > 0}
          aria-controls={`${inputId}-suggestions`}
          disabled={disabled}
          className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-ink placeholder:text-muted focus:outline-none"
        />
      </form>

      {/*
        * Task 4-9: 探している間はそう言う。
        * 「見つかりませんでした」はここには出さない。この欄は候補が無くても
        * Enter で地名そのものを座標に変えて進めるので（SearchTopScreen の自由入力）、
        * 「見つからない」と言い切ると**進める道があるのに行き止まりに見える**。
        */}
      {isSearching && (
        <p role="status" className="mt-1 px-4 text-[12px] text-muted">
          探しています…
        </p>
      )}

      {isOpen && visibleSuggestions.length > 0 && (
        <ul
          id={`${inputId}-suggestions`}
          role="listbox"
          className="absolute z-20 mt-1 w-full overflow-hidden rounded-[12px] border border-line bg-surface shadow-card"
        >
          {visibleSuggestions.map((suggestion) => (
            <li key={`${suggestion.kind}:${suggestion.name}`} role="option" aria-selected={false}>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => select(suggestion)}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[14px] text-ink hover:bg-tint"
              >
                <span className="text-muted" aria-hidden>
                  {suggestion.kind === "spot" ? "🏷" : "📍"}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {suggestion.name}
                  {"secondaryText" in suggestion && suggestion.secondaryText && (
                    <span className="ml-1.5 text-[11px] text-muted">{suggestion.secondaryText}</span>
                  )}
                </span>
                <span className="shrink-0 text-[11px] text-muted">{SUGGESTION_KIND_LABELS[suggestion.kind]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function newSessionToken(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());
}
