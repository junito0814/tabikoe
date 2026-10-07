"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AreaPicker } from "./AreaPicker";
import { CloseButton } from "@/components/ui/CloseButton";
import { POST_CATEGORIES, POST_DURATIONS, type PostCategory } from "@/lib/posts/constants";
import {
  COST_RANGE_LABELS,
  COST_RANGES,
  PERIOD_LABELS,
  PERIOD_OPTIONS,
} from "@/lib/posts/search-posts";
import type { CostRange, DistanceOption, PeriodOption } from "@/lib/posts/search-posts";
import type { PostDuration } from "@/lib/posts/constants";
import type { ListView } from "@/lib/search/list-view";
import { TERMS } from "@/lib/terms";

/**
 * post-timeline Task2: 絞り込みシート（下から出るパネル）
 * 出典: docs/tasks/map-search/post-timeline/02-timeline-ui.md
 *       要件定義書 v3.0 3.4.2（予算・期間・カテゴリ 7・滞在時間・距離）
 *       explore-mode Task 4（2026-10-02）: 地図の「場所を絞る」用の出し分けを追加（要件 3.4.6）
 *
 * 【初心者向け】シートの中では `draft`（編集中の条件）を持ち、「この条件で表示」で親に渡す。
 * 親の state を直接いじらないのは、途中でやめて「閉じる」を押したときに元に戻せるようにするため。
 * #681: 距離は廃止した（地図タブに置き換え。要件 3.4.2）。
 * 費用が未入力の投稿は予算の絞り込みで除外される（サーバー側の判定。ここでは案内文だけ）。
 *
 * このシートは 2 か所で使う（同じ見た目を 2 つ書かないため。約束 14）。
 *   variant="posts" … 投稿一覧（3.4.2）。予算・期間・カテゴリ・滞在時間・距離
 *   variant="spots" … 地図の探すモード（3.4.6）。カテゴリ・予算（平均）・滞在時間・評価（平均）・タビコエだけの場所
 *                     期間と距離は出さない（移動手段が範囲を決めているため）
 */

/** シートが触る条件。投稿一覧の状態（PostSearchState）も地図の条件も、この形を満たす */
export interface SheetFilters {
  categories: readonly string[];
  cost: CostRange | null;
  duration: PostDuration | null;
  period?: PeriodOption | null;
  from?: string;
  to?: string;
  distance?: DistanceOption | null;
  /** explore-mode Task 4: 平均評価の下限（1〜5）。地図だけ */
  rating?: number | null;
  /** explore-mode Task 4: 「タビコエだけの場所」だけを出すか。地図だけ */
  /** #809: エリア（都道府県の並び）。「みんなの投稿」のときだけ使う */
  areas?: string[];
  /** 投稿一覧の「条件をクリア」で一緒に消すもの（地図には無い） */
  keyword?: string;
  view?: ListView;
}

/** 「条件をクリア」で戻す値（並び替えは条件ではないので触らない） */
const CLEARED_FILTERS: SheetFilters = {
  categories: [],
  areas: [],
  cost: null,
  duration: null,
  period: null,
  from: "",
  to: "",
  distance: null,
  rating: null,
  keyword: "",
  view: "posts",
};

/** 評価（平均）の選択肢。★5 だけは「以上」と書かない（上が無いため） */
const RATING_OPTIONS = [1, 2, 3, 4, 5] as const;

export type FilterSheetVariant = "posts" | "spots";

export function FilterSheet<T extends SheetFilters>({
  open,
  value,
  variant = "posts",
  showArea = false,
  onApply,
  onClose,
}: {
  open: boolean;
  value: T;
  variant?: FilterSheetVariant;
  /** #809: エリアの行を出すか（「みんなの投稿」のときだけ true） */
  showArea?: boolean;
  /**
   * post-timeline Task 6（2026-10-03）: 「タビコエだけの場所」を出すか（投稿一覧のとき）。
   *
   * 【初心者向け】地図（variant="spots"）では必ず出す。投稿一覧では**検索結果のときだけ**出す
   * （スポット別の一覧では、そのスポットがもう決まっているので絞る意味が無い。要件 3.4.2）。
   */
  onApply: (next: T) => void;
  onClose: () => void;
}) {
  // 閉じているときは中身ごと外す。開くたびに中身が作り直され、draft が適用中の条件から始まる
  if (!open) return null;
  return <FilterSheetBody value={value} variant={variant} showArea={showArea} onApply={onApply} onClose={onClose} />;
}

function FilterSheetBody<T extends SheetFilters>({
  value,
  variant,
  showArea,
  onApply,
  onClose,
}: {
  value: T;
  variant: FilterSheetVariant;
  showArea: boolean;
  onApply: (next: T) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<T>(value);
  const isSpots = variant === "spots";
  // #809: 「エリア」を押すと、同じシートの中が都道府県を選ぶ画面に切り替わる（画面を増やさない）
  const [isPickingArea, setIsPickingArea] = useState(false);
  const areas = draft.areas ?? [];

  /*
   * 条件を 1 つだけ書き換える。
   *
   * 【初心者向け】このシートは「投稿一覧の条件」と「地図の条件」の**どちらも**扱うので、
   * 受け取った形（T）をそのまま返す。渡された形に無い項目は増やさないので、
   * 書き換えた結果も同じ形のまま ── それを型に伝えるために、ここだけ `as T` を使う。
   */
  const patch = (changes: Partial<SheetFilters>) => setDraft((current) => ({ ...current, ...changes }) as T);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const toggleCategory = (category: PostCategory) => {
    patch({
      categories: draft.categories.includes(category) ? draft.categories.filter((item) => item !== category) : [...draft.categories, category],
    });
  };

  const chip = (selected: boolean, disabled = false) =>
    `cursor-pointer rounded-full border px-3 py-1.5 text-[0.75rem] font-medium ${
      selected ? "border-accent bg-accent text-white" : "border-line text-ink"
    } ${disabled ? "opacity-45" : ""}`;

  /*
   * 項目は「出すかどうか」だけでなく「**並び順**」も用途で変える（2026-10-02 に決定）。
   *
   * 【初心者向け】そのため 1 つずつ変数にしてから、下で並べている。
   *   投稿一覧 … 予算・期間・カテゴリ・滞在時間・距離
   *   地図     … カテゴリ・予算（平均）・滞在時間・評価（平均）・タビコエだけの場所
   * 地図でカテゴリを先に置くのは、出先で探す人がまず決めるのが「何を探しているか」だから。
   */
  /*
   * explore-mode Task 5（2026-10-03）: 1 つだけ選ぶ列。
   *
   * 【初心者向け】**「指定なし」は置かず、選んだものをもう一度押すと解除**する
   * （カテゴリと同じ操作。要件 3.4.2「絞り込みの選び方」）。以前はシートの中で
   * 「カテゴリはもう一度押して外す／ほかは『指定なし』に戻す」と**選び方が 2 通り**に
   * 分かれていた。見た目が同じ丸いボタンなのに動きが違うので揃えた。
   *
   * 作りは**チェックボックス**。ラジオボタン（`type="radio"`）は一度選ぶと外せない
   * 決まりなので、「もう一度押して解除」が作れない。1 つ選んだら他が外れるのは、
   * `checked` を 1 つだけにして自分で書いている。
   *
   * 5 つの列（予算・期間・滞在時間・距離・評価）が同じ形なので、1 つにまとめた（約束 14）。
   */
  const singleChoice = <V extends string | number,>(
    key: string,
    legend: string,
    options: readonly V[],
    selected: V | null,
    onSelect: (next: V | null) => void,
    label: (option: V) => string = String,
    extra?: ReactNode
  ) => (
    <fieldset key={key}>
      <legend className="mb-1.5 text-[0.75rem] font-medium text-muted">{legend}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const checked = selected === option;
          return (
            <label key={String(option)} className={chip(checked)}>
              {/* もう一度押したら null（条件なし）に戻す */}
              <input type="checkbox" checked={checked} onChange={() => onSelect(checked ? null : option)} className="sr-only" />
              {label(option)}
            </label>
          );
        })}
      </div>
      {extra}
    </fieldset>
  );

  /*
   * 項目は「出すかどうか」だけでなく「**並び順**」も用途で変える（2026-10-02 に決定）。
   *
   * 【初心者向け】そのため 1 つずつ変数にしてから、下で並べている。
   *   投稿一覧 … 予算・期間・カテゴリ・滞在時間・距離
   *   地図     … カテゴリ・予算（平均）・滞在時間・評価（平均）・タビコエだけの場所
   * 地図でカテゴリを先に置くのは、出先で探す人がまず決めるのが「何を探しているか」だから。
   */
  const costSection = singleChoice(
    "cost",
    isSpots ? "予算（平均）" : "予算（1人あたり）",
    COST_RANGES,
    draft.cost,
    (next) => patch({ cost: next }),
    (range) => COST_RANGE_LABELS[range],
    // 地図は文字を増やさない（見出しの「（平均）」で意味が通る）。2026-10-02 の決定
    isSpots ? undefined : <p className="mt-1 text-[0.6875rem] text-muted">費用が未入力の投稿は、予算で絞り込むと表示されません</p>
  );

  const periodSection = singleChoice(
    "period",
    "期間（訪問日）",
    PERIOD_OPTIONS,
    draft.period ?? null,
    (next) => patch({ period: next }),
    (option) => PERIOD_LABELS[option],
    draft.period === "custom" ? (
      <div className="mt-2 flex items-center gap-2 text-[0.75rem] text-ink">
        <input
          type="date"
          aria-label="開始日"
          value={draft.from ?? ""}
          onChange={(event) => patch({ from: event.target.value })}
          className="h-9 min-w-0 flex-1 rounded-[8px] border border-line bg-surface px-2 text-[0.75rem] text-ink"
        />
        <span aria-hidden>〜</span>
        <input
          type="date"
          aria-label="終了日"
          value={draft.to ?? ""}
          onChange={(event) => patch({ to: event.target.value })}
          className="h-9 min-w-0 flex-1 rounded-[8px] border border-line bg-surface px-2 text-[0.75rem] text-ink"
        />
      </div>
    ) : undefined
  );

  const categorySection = (
    <fieldset key="categories">
      <legend className="mb-1.5 text-[0.75rem] font-medium text-muted">カテゴリ（複数選択可）</legend>
      <div className="flex flex-wrap gap-1.5">
        {POST_CATEGORIES.map((category) => {
          const checked = draft.categories.includes(category);
          return (
            <label key={category} className={chip(checked)}>
              <input type="checkbox" checked={checked} onChange={() => toggleCategory(category)} className="sr-only" />
              {category}
            </label>
          );
        })}
      </div>
    </fieldset>
  );

  const durationSection = singleChoice("duration", "滞在時間", POST_DURATIONS, draft.duration, (next) => patch({ duration: next }));

  /*
   * #681: 「距離（検索した場所から）」は廃止した（要件 3.4.2・決定事項 71）。
   * 地図タブが付くと基準点が 2 つ（検索した場所と地図の中心）になり紛らわしいので、
   * **地図を動かして見る**形に置き換えた。
   */

  /* explore-mode Task 4: 評価（平均）。「★4 以上」は平均 4.0 ちょうどを含む（要件 3.4.6） */
  const ratingSection = singleChoice(
    "rating",
    "評価（平均）",
    RATING_OPTIONS,
    draft.rating ?? null,
    (next) => patch({ rating: next }),
    // ★5 だけは「以上」と書かない（上が無いため）
    (option) => (option === 5 ? "★5" : `★${option} 以上`)
  );


  // Bug #473: スポット別一覧は上 1/3 地図＋下 2/3 シート（MapSheetLayout）の中にあり、そのシートが `relative z-10` で
  // 重なり順の入れ物（stacking context）を作る。その中で fixed にしても z-10 の枠から出られず、メニューバー（z-40）の下に
  // なる。createPortal で body 直下に描いて枠の外に出し、z-50 でメニューバーより上にする。
  // メニューバーは隠さず残す: バーがあるとき（body:has([data-menu-bar])）はスマホで下 60px、パソコンで左 200px を空け、
  // 暗い背景もシートもメニューバーの手前で止める（メニューバーはそのまま押せる）。
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center [body:has([data-menu-bar])_&]:bottom-[60px] md:[body:has([data-menu-bar])_&]:bottom-0 md:[body:has([data-menu-bar])_&]:left-[200px]" data-filter-sheet>
      <button type="button" aria-label="閉じる" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="filter-sheet-title"
        onSubmit={(event) => {
          event.preventDefault();
          onApply(draft);
        }}
        className="relative flex max-h-[85dvh] w-full max-w-[520px] flex-col gap-4 overflow-y-auto rounded-t-[16px] bg-surface p-4 pb-[max(16px,env(safe-area-inset-bottom))] shadow-card md:rounded-[16px]"
      >
        <div className="flex items-center justify-between">
          <h2 id="filter-sheet-title" className="text-[0.9375rem] font-bold text-ink">
            絞り込み
          </h2>
          {/* #712: 文字の「閉じる」をやめ、右上の × に揃えた（要件 4.5.13） */}
          <CloseButton onClick={onClose} />
        </div>

        {isPickingArea ? (
          <AreaPicker selected={areas} onChange={(next) => patch({ areas: next })} onBack={() => setIsPickingArea(false)} />
        ) : (
          <>
        {/*
          * #809: エリアは**いちばん上**。「みんなの投稿」は行き先が決まっていないので、
          * まず「どこの」を決めたい人が多い。検索結果（行き先あり）では出さない。
          */}
        {showArea && (
          <button
            type="button"
            onClick={() => setIsPickingArea(true)}
            data-area-row
            className="flex items-center gap-2 rounded-[10px] border border-line px-3 py-2.5 text-[0.8125rem] text-ink"
          >
            エリア
            <span className="ml-auto text-[0.75rem] text-muted">{areas.length === 0 ? "指定なし" : `${areas.length} 都道府県`}</span>
            <span className="text-muted" aria-hidden>›</span>
          </button>
        )}

        {isSpots
          /* #680: 「タビコエだけの場所」の行は廃止（決定事項 70）。地図は 4 つ、投稿一覧は 5 つ */
          ? [categorySection, costSection, durationSection, ratingSection]
          : [costSection, periodSection, categorySection, durationSection]}

        <div className="flex justify-between">
          <button
            type="button"
            onClick={() => patch(CLEARED_FILTERS)}
            className="text-[0.75rem] font-medium text-muted underline underline-offset-2"
          >
            {TERMS.clearFilters}
          </button>
          <button type="submit" className="h-10 rounded-[10px] bg-ink px-4 text-[0.8125rem] font-semibold text-on-ink">
            この条件で表示
          </button>
        </div>
          </>
        )}
      </form>
    </div>,
    document.body
  );
}
