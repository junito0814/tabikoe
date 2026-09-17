"use client";

import { useEffect, useState } from "react";
import { POST_CATEGORIES, POST_DURATIONS, type PostCategory } from "@/lib/posts/constants";
import {
  COST_RANGE_LABELS,
  COST_RANGES,
  DISTANCE_LABELS,
  DISTANCE_OPTIONS,
  PERIOD_LABELS,
  PERIOD_OPTIONS,
} from "@/lib/posts/search-posts";
import { EMPTY_SEARCH_STATE, type PostSearchState } from "./post-search-query";

/**
 * post-timeline Task2: 絞り込みシート（下から出るパネル）
 * 出典: docs/tasks/map-search/post-timeline/02-timeline-ui.md
 *       要件定義書 v3.0 3.4.2（予算・期間・カテゴリ 7・滞在時間・距離）
 *
 * 【初心者向け】シートの中では `draft`（編集中の条件）を持ち、「この条件で表示」で親に渡す。
 * 親の state を直接いじらないのは、途中でやめて「閉じる」を押したときに元に戻せるようにするため。
 * 距離は基準点（駅・スポット検索・現在地）があるときだけ出す（`hasDistanceCenter`）。
 * 費用が未入力の投稿は予算の絞り込みで除外される（サーバー側の判定。ここでは案内文だけ）。
 */
export function FilterSheet({
  open,
  value,
  hasDistanceCenter,
  onApply,
  onClose,
}: {
  open: boolean;
  value: PostSearchState;
  hasDistanceCenter: boolean;
  onApply: (next: PostSearchState) => void;
  onClose: () => void;
}) {
  // 閉じているときは中身ごと外す。開くたびに中身が作り直され、draft が適用中の条件から始まる
  if (!open) return null;
  return <FilterSheetBody value={value} hasDistanceCenter={hasDistanceCenter} onApply={onApply} onClose={onClose} />;
}

function FilterSheetBody({
  value,
  hasDistanceCenter,
  onApply,
  onClose,
}: {
  value: PostSearchState;
  hasDistanceCenter: boolean;
  onApply: (next: PostSearchState) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<PostSearchState>(value);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const toggleCategory = (category: PostCategory) => {
    setDraft((current) => ({
      ...current,
      categories: current.categories.includes(category)
        ? current.categories.filter((item) => item !== category)
        : [...current.categories, category],
    }));
  };

  const chip = (selected: boolean, disabled = false) =>
    `cursor-pointer rounded-full border px-3 py-1.5 text-[12px] font-medium ${
      selected ? "border-accent bg-accent text-white" : "border-line text-ink"
    } ${disabled ? "opacity-45" : ""}`;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center md:items-center" data-filter-sheet>
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

        <fieldset>
          <legend className="mb-1.5 text-[12px] font-medium text-muted">予算（1人あたり）</legend>
          <div className="flex flex-wrap gap-1.5">
            <label className={chip(draft.cost === null)}>
              <input type="radio" name="cost" checked={draft.cost === null} onChange={() => setDraft((c) => ({ ...c, cost: null }))} className="sr-only" />
              指定なし
            </label>
            {COST_RANGES.map((range) => (
              <label key={range} className={chip(draft.cost === range)}>
                <input type="radio" name="cost" checked={draft.cost === range} onChange={() => setDraft((c) => ({ ...c, cost: range }))} className="sr-only" />
                {COST_RANGE_LABELS[range]}
              </label>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-muted">費用が未入力の投稿は、予算で絞り込むと表示されません</p>
        </fieldset>

        <fieldset>
          <legend className="mb-1.5 text-[12px] font-medium text-muted">期間（訪問日）</legend>
          <div className="flex flex-wrap gap-1.5">
            <label className={chip(draft.period === null)}>
              <input type="radio" name="period" checked={draft.period === null} onChange={() => setDraft((c) => ({ ...c, period: null }))} className="sr-only" />
              指定なし
            </label>
            {PERIOD_OPTIONS.map((option) => (
              <label key={option} className={chip(draft.period === option)}>
                <input type="radio" name="period" checked={draft.period === option} onChange={() => setDraft((c) => ({ ...c, period: option }))} className="sr-only" />
                {PERIOD_LABELS[option]}
              </label>
            ))}
          </div>
          {draft.period === "custom" && (
            <div className="mt-2 flex items-center gap-2 text-[12px] text-ink">
              <input
                type="date"
                aria-label="開始日"
                value={draft.from}
                onChange={(event) => setDraft((c) => ({ ...c, from: event.target.value }))}
                className="h-9 min-w-0 flex-1 rounded-[8px] border border-line bg-surface px-2 text-[12px] text-ink"
              />
              <span aria-hidden>〜</span>
              <input
                type="date"
                aria-label="終了日"
                value={draft.to}
                onChange={(event) => setDraft((c) => ({ ...c, to: event.target.value }))}
                className="h-9 min-w-0 flex-1 rounded-[8px] border border-line bg-surface px-2 text-[12px] text-ink"
              />
            </div>
          )}
        </fieldset>

        <fieldset>
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

        <fieldset>
          <legend className="mb-1.5 text-[12px] font-medium text-muted">滞在時間</legend>
          <div className="flex flex-wrap gap-1.5">
            <label className={chip(draft.duration === null)}>
              <input type="radio" name="duration" checked={draft.duration === null} onChange={() => setDraft((c) => ({ ...c, duration: null }))} className="sr-only" />
              指定なし
            </label>
            {POST_DURATIONS.map((option) => (
              <label key={option} className={chip(draft.duration === option)}>
                <input type="radio" name="duration" checked={draft.duration === option} onChange={() => setDraft((c) => ({ ...c, duration: option }))} className="sr-only" />
                {option}
              </label>
            ))}
          </div>
        </fieldset>

        {hasDistanceCenter && (
          <fieldset>
            <legend className="mb-1.5 text-[12px] font-medium text-muted">距離（検索した場所から）</legend>
            <div className="flex flex-wrap gap-1.5">
              <label className={chip(draft.distance === null)}>
                <input type="radio" name="distance" checked={draft.distance === null} onChange={() => setDraft((c) => ({ ...c, distance: null }))} className="sr-only" />
                指定なし
              </label>
              {DISTANCE_OPTIONS.map((option) => (
                <label key={option} className={chip(draft.distance === option)}>
                  <input type="radio" name="distance" checked={draft.distance === option} onChange={() => setDraft((c) => ({ ...c, distance: option }))} className="sr-only" />
                  {DISTANCE_LABELS[option]}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <div className="flex justify-between">
          <button
            type="button"
            onClick={() => setDraft({ ...EMPTY_SEARCH_STATE, sort: draft.sort })}
            className="text-[12px] font-medium text-muted underline underline-offset-2"
          >
            条件をクリア
          </button>
          <button type="submit" className="h-10 rounded-[10px] bg-ink px-4 text-[13px] font-semibold text-white">
            この条件で表示
          </button>
        </div>
      </form>
    </div>
  );
}
