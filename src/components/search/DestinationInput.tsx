"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { UnauthorizedError } from "@/lib/api/fetch-with-auth-redirect";
import { SUGGESTION_KIND_LABELS, type DestinationSuggestion } from "@/lib/search/suggest-destinations";
import { GoogleMapsAttribution } from "@/components/google/GoogleMapsAttribution";
import {
  ATTRIBUTION_SOURCE_LABELS,
  destinationSuggestionSource,
  groupBySource,
} from "@/lib/google/attribution-source";

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
  /*
   * #740: 候補の高さは「入力欄の下に実際に残っている余白」で決める。
   *
   * 【初心者向け】決め打ちの上限（420px）だと、入力欄が画面の真ん中にある
   * ホーム画面では下がメニューバーに隠れてしまい、**Google のロゴまで見えなくなっていた**
   * （規約が求める表記なので、見えないのは出していないのと同じ）。
   * 測れないとき（サーバーでの描画・テスト）は CSS の上限のままにする。
   */
  const panelRef = useRef<HTMLDivElement>(null);
  const [maxHeight, setMaxHeight] = useState<number | null>(null);
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
  /*
   * #665（2026-10-03）: 日本語の変換中か。
   *
   * 【初心者向け】日本語入力は「とうきょう」と打ってから変換して「東京」を確定する。
   * 変換前の文字でも入力は止まるので、そのまま 300ms 数えると**確定前の言葉で候補を取りに行く**。
   * そのあと確定して文字が変わると、「探し終えた言葉」と一致しなくなって**出ていた候補が消える**
   * （実機で「候補が出たり消えたりする」と報告された現象）。
   * 変換が終わるまで待てば、取りに行くのは確定した言葉の 1 回だけになる
   * （Places の呼び出し回数＝費用も減る）。
   */
  const [isComposing, setIsComposing] = useState(false);
  /*
   * #665: 問い合わせの世代。
   *
   * 【初心者向け】`とうきょう` と `東京` の 2 本が飛んだとき、**遅れて古い方が届くと新しい候補を
   * 上書きする**。しかも「探し終えた言葉」まで古い方に戻るので、候補が消えたまま戻らず
   * 「探しています…」が出たままになっていた（次にキーを打つまで直らない）。
   * 出すたびに番号を 1 つ進め、**最後に出した番号の応答だけ**を使う（地図のピン取得と同じやり方）。
   */
  const requestIdRef = useRef(0);
  const suggestRef = useRef(suggest);
  useEffect(() => {
    suggestRef.current = suggest;
  }, [suggest]);

  useEffect(() => {
    if (focusSignal > 0) inputRef.current?.focus();
  }, [focusSignal]);

  useEffect(() => {
    // #665: 変換が終わるまで待つ（確定前の言葉で取りに行かない）
    if (isComposing) return;
    const trimmed = query.trim();
    // 空になったら候補を消す（同期の setState を避けるため、タイマー経由で行う）
    const timer = setTimeout(async () => {
      if (!trimmed) {
        setSuggestions([]);
        setSearchedQuery(trimmed);
        return;
      }
      const requestId = ++requestIdRef.current;
      try {
        const result = await suggestRef.current(trimmed, sessionToken);
        // #665: 自分より後に出した問い合わせがあるなら、この応答は捨てる
        if (requestIdRef.current !== requestId) return;
        setSuggestions(result.suggestions);
        setIsOpen(true);
      } catch (error) {
        if (error instanceof UnauthorizedError) return;
        if (requestIdRef.current !== requestId) return;
        setSuggestions([]);
      }
      // 成功・失敗どちらでも「この言葉は探し終えた」と記録する（待ち表示が出たままにならないように）
      setSearchedQuery(trimmed);
    }, trimmed ? DEBOUNCE_MS : 0);
    return () => clearTimeout(timer);
  }, [query, sessionToken, isComposing]);

  /** #740: メニューバーの高さ（スマホのとき。パソコンは左の縦並びなので引かない） */
  const MENU_BAR_PX = 60;
  const PANEL_GAP_PX = 8;
  /** これ以上縮んでいたらキーボードが出ていると見なす */
  const KEYBOARD_THRESHOLD_PX = 120;


  const trimmedQuery = query.trim();
  /** 探し終えた言葉がいまの入力と一致するときだけ候補を使う（前の言葉の候補を残さない） */
  const visibleSuggestions = searchedQuery === trimmedQuery ? suggestions : [];

  /*
   * #740・#749: 候補の高さは「入力欄の下に**実際に見えている**余白」で決める。
   *
   * 【初心者向け】#740 では画面全体の高さ（`window.innerHeight`）で測っていたが、
   * **実機では文字を打っている間キーボードが出ていて、見えるのはその上だけ**だった。
   * そのため Google のロゴがキーボードの下に隠れていた（規約が求める表記なので、
   * 見えないのは出していないのと同じ）。
   *
   * `window.visualViewport` は「いま実際に見えている範囲」を表す。キーボードが出ると縮む。
   * 開閉のたびに測り直すので、閉じれば元の高さに戻る。
   */
  useLayoutEffect(() => {
    const measure = () => {
      const panel = panelRef.current;
      if (!panel) {
        setMaxHeight(null);
        return;
      }
      const viewport = window.visualViewport;
      // 見えている範囲の下端。キーボードが出ているとここが上がる
      const visibleBottom = viewport ? viewport.offsetTop + viewport.height : window.innerHeight;
      // キーボードが出ているとメニューバーもその下に隠れるので、そのときは引かない
      const keyboardOpen = viewport ? window.innerHeight - viewport.height > KEYBOARD_THRESHOLD_PX : false;
      const bar = !keyboardOpen && window.innerWidth < 768 ? MENU_BAR_PX : 0;
      const top = panel.getBoundingClientRect().top;
      const space = Math.floor(visibleBottom - top - bar - PANEL_GAP_PX);
      /*
       * 測れたなら、その値を**必ず**使う。
       *
       * 【初心者向け】最初は「狭すぎたら CSS の上限に任せる」としていたが、それだと
       * **狭いときほど背が高くなる**（上限 420px に戻る）という逆の動きになり、
       * キーボードが出たときにロゴが隠れたままだった（2026-10-06 に測って気づいた）。
       * 狭いときは狭いまま出す ── 中はスクロールでき、ロゴはその外に固定してあるので必ず見える。
       */
      setMaxHeight(space > 0 ? space : null);
    };

    measure();
    const viewport = window.visualViewport;
    if (!viewport) return;
    viewport.addEventListener("resize", measure);
    viewport.addEventListener("scroll", measure);
    return () => {
      viewport.removeEventListener("resize", measure);
      viewport.removeEventListener("scroll", measure);
    };
  }, [isOpen, visibleSuggestions.length]);
  /** 探している最中か。300ms 待っている間も含む（#665: 変換中は探していないので出さない） */
  const isSearching = !isComposing && trimmedQuery.length > 0 && searchedQuery !== trimmedQuery;

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
          /* #665: 日本語の変換中は候補を取りに行かない（確定してから数え始める） */
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={(event) => {
            // 確定した文字は change より先に届くことがあるので、ここでも取り込む
            setQuery(event.currentTarget.value);
            setIsComposing(false);
          }}
          onFocus={() => visibleSuggestions.length > 0 && setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 150)}
          placeholder="どこへ行く？"
          aria-label="行き先"
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen && visibleSuggestions.length > 0}
          aria-controls={`${inputId}-suggestions`}
          disabled={disabled}
          className="h-full min-w-0 flex-1 bg-transparent text-[0.9375rem] text-ink placeholder:text-muted focus:outline-none"
        />
      </form>

      {/*
        * Task 4-9: 探している間はそう言う。
        * 「見つかりませんでした」はここには出さない。この欄は候補が無くても
        * Enter で地名そのものを座標に変えて進めるので（SearchTopScreen の自由入力）、
        * 「見つからない」と言い切ると**進める道があるのに行き止まりに見える**。
        */}
      {isSearching && (
        <p role="status" className="mt-1 px-4 text-[0.75rem] text-muted">
          探しています…
        </p>
      )}

      {/*
        * #699: 出どころ（タビコエ／Google）で分け、Google の組の下に公式のロゴを置く。
        * Google の規約が「Places のデータを地図の無い画面に出すときは表記を出す」
        * 「どれが Google 由来か分かるようにする」と求めている（要件 6.2）。
        */}
      {isOpen && visibleSuggestions.length > 0 && (
        /*
         * #740: メニューバー（z-40）より上に出し、高さに上限を付けて中をスクロールさせる。
         * 候補が増えると下がメニューバーに隠れ、**Google のロゴまで見えなくなっていた**
         * （規約が求める表記なので、見えないのは出していないのと同じ）。
         */
        <div
          ref={panelRef}
          style={maxHeight === null ? undefined : { maxHeight }}
          className="absolute z-50 mt-1 flex max-h-[min(420px,50dvh)] w-full flex-col overflow-hidden rounded-[12px] border border-line bg-surface shadow-card"
        >
          <div className="min-h-0 flex-1 overflow-y-auto">
          {groupBySource(visibleSuggestions, (suggestion) => destinationSuggestionSource(suggestion.kind)).map(
            (group, groupIndex) => (
              <section key={group.source} className={groupIndex > 0 ? "border-t border-line" : undefined}>
                <h3 className="px-4 pb-0.5 pt-2 text-[0.65625rem] font-bold text-muted">
                  {ATTRIBUTION_SOURCE_LABELS[group.source]}
                </h3>
                <ul
                  id={groupIndex === 0 ? `${inputId}-suggestions` : undefined}
                  role="listbox"
                  aria-label={ATTRIBUTION_SOURCE_LABELS[group.source]}
                >
                  {group.items.map((suggestion) => (
                    <li key={`${suggestion.kind}:${suggestion.name}`} role="option" aria-selected={false}>
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => select(suggestion)}
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[0.875rem] text-ink hover:bg-tint"
                      >
                        <span className="text-muted" aria-hidden>
                          {suggestion.kind === "spot" ? "🏷" : "📍"}
                        </span>
                        <span className="min-w-0 flex-1 truncate">
                          {suggestion.name}
                          {"secondaryText" in suggestion && suggestion.secondaryText && (
                            <span className="ml-1.5 text-[0.6875rem] text-muted">{suggestion.secondaryText}</span>
                          )}
                        </span>
                        <span className="shrink-0 text-[0.6875rem] text-muted">{SUGGESTION_KIND_LABELS[suggestion.kind]}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )
          )}
          </div>
          {/*
            * #740: ロゴはスクロールの外に固定する。中に入れると「スクロールしないと見えない」ことがあり、
            * 規約の「見える位置に出す」を満たさない。
            */}
          {visibleSuggestions.some((suggestion) => destinationSuggestionSource(suggestion.kind) === "google") && (
            <div className="shrink-0 border-t border-line bg-surface px-4 py-2">
              <GoogleMapsAttribution />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function newSessionToken(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());
}
