"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { POST_CATEGORIES, POST_DURATIONS, type PostCategory } from "@/lib/posts/constants";
import {
  COST_RANGE_LABELS,
  COST_RANGES,
  DISTANCE_LABELS,
  DISTANCE_OPTIONS,
  PERIOD_LABELS,
  PERIOD_OPTIONS,
} from "@/lib/posts/search-posts";
import type { CostRange, DistanceOption, PeriodOption } from "@/lib/posts/search-posts";
import type { PostDuration } from "@/lib/posts/constants";
import type { ListView } from "@/lib/search/list-view";

/**
 * post-timeline Task2: 絞り込みシート（下から出るパネル）
 * 出典: docs/tasks/map-search/post-timeline/02-timeline-ui.md
 *       要件定義書 v3.0 3.4.2（予算・期間・カテゴリ 7・滞在時間・距離）
 *       explore-mode Task 4（2026-10-02）: 地図の「場所を絞る」用の出し分けを追加（要件 3.4.6）
 *
 * 【初心者向け】シートの中では `draft`（編集中の条件）を持ち、「この条件で表示」で親に渡す。
 * 親の state を直接いじらないのは、途中でやめて「閉じる」を押したときに元に戻せるようにするため。
 * 距離は基準点（駅・スポット検索・現在地）があるときだけ出す（`hasDistanceCenter`）。
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
  manualOnly?: boolean;
  /** 投稿一覧の「条件をクリア」で一緒に消すもの（地図には無い） */
  keyword?: string;
  view?: ListView;
}

/** 「条件をクリア」で戻す値（並び替えは条件ではないので触らない） */
const CLEARED_FILTERS: SheetFilters = {
  categories: [],
  cost: null,
  duration: null,
  period: null,
  from: "",
  to: "",
  distance: null,
  rating: null,
  manualOnly: false,
  keyword: "",
  view: "posts",
};

/** 評価（平均）の選択肢。★5 だけは「以上」と書かない（上が無いため） */
const RATING_OPTIONS = [1, 2, 3, 4, 5] as const;

export type FilterSheetVariant = "posts" | "spots";

export function FilterSheet<T extends SheetFilters>({
  open,
  value,
  hasDistanceCenter,
  variant = "posts",
  onApply,
  onClose,
}: {
  open: boolean;
  value: T;
  hasDistanceCenter: boolean;
  variant?: FilterSheetVariant;
  onApply: (next: T) => void;
  onClose: () => void;
}) {
  // 閉じているときは中身ごと外す。開くたびに中身が作り直され、draft が適用中の条件から始まる
  if (!open) return null;
  return <FilterSheetBody value={value} hasDistanceCenter={hasDistanceCenter} variant={variant} onApply={onApply} onClose={onClose} />;
}

function FilterSheetBody<T extends SheetFilters>({
  value,
  hasDistanceCenter,
  variant,
  onApply,
  onClose,
}: {
  value: T;
  hasDistanceCenter: boolean;
  variant: FilterSheetVariant;
  onApply: (next: T) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<T>(value);
  const isSpots = variant === "spots";

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
    `cursor-pointer rounded-full border px-3 py-1.5 text-[12px] font-medium ${
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
      <legend className="mb-1.5 text-[12px] font-medium text-muted">{legend}</legend>
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
    isSpots ? undefined : <p className="mt-1 text-[11px] text-muted">費用が未入力の投稿は、予算で絞り込むと表示されません</p>
  );

  const periodSection = singleChoice(
    "period",
    "期間（訪問日）",
    PERIOD_OPTIONS,
    draft.period ?? null,
    (next) => patch({ period: next }),
    (option) => PERIOD_LABELS[option],
    draft.period === "custom" ? (
      <div className="mt-2 flex items-center gap-2 text-[12px] text-ink">
        <input
          type="date"
          aria-label="開始日"
          value={draft.from ?? ""}
          onChange={(event) => patch({ from: event.target.value })}
          className="h-9 min-w-0 flex-1 rounded-[8px] border border-line bg-surface px-2 text-[12px] text-ink"
        />
        <span aria-hidden>〜</span>
        <input
          type="date"
          aria-label="終了日"
          value={draft.to ?? ""}
          onChange={(event) => patch({ to: event.target.value })}
          className="h-9 min-w-0 flex-1 rounded-[8px] border border-line bg-surface px-2 text-[12px] text-ink"
        />
      </div>
    ) : undefined
  );

  const categorySection = (
    <fieldset key="categories">
      <legend className="mb-1.5 text-[12px] font-medium text-muted">カテゴリ（複数選択可）</legend>
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

  const distanceSection = hasDistanceCenter
    ? singleChoice(
        "distance",
        "距離（検索した場所から）",
        DISTANCE_OPTIONS,
        draft.distance ?? null,
        (next) => patch({ distance: next }),
        (option) => DISTANCE_LABELS[option]
      )
    : null;

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

  /* explore-mode Task 4: タビコエだけの場所（spots.source = manual）。チェックボックス 1 行 */
  const manualSection = (
    <label key="manual" className="flex items-center gap-2 text-[12px] text-ink">
      <input
        type="checkbox"
        checked={draft.manualOnly === true}
        onChange={(event) => patch({ manualOnly: event.target.checked })}
        className="h-4 w-4 accent-accent"
      />
      <span>
        <b className="font-bold">タビコエだけの場所</b>だけを出す
      </span>
    </label>
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
          <h2 id="filter-sheet-title" className="text-[15px] font-bold text-ink">
            絞り込み
          </h2>
          <button type="button" onClick={onClose} className="text-[12px] font-medium text-muted underline underline-offset-2">
            閉じる
          </button>
        </div>

        {isSpots
          ? [categorySection, costSection, durationSection, ratingSection, manualSection]
          : [costSection, periodSection, categorySection, durationSection, distanceSection]}

        <div className="flex justify-between">
          <button
            type="button"
            onClick={() => patch(CLEARED_FILTERS)}
            className="text-[12px] font-medium text-muted underline underline-offset-2"
          >
            条件をクリア
          </button>
          <button type="submit" className="h-10 rounded-[10px] bg-ink px-4 text-[13px] font-semibold text-on-ink">
            この条件で表示
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}
