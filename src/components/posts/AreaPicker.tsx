"use client";

import { REGIONS, regionState, togglePrefecture, toggleRegion } from "@/lib/search/regions";

/**
 * #809: 絞り込みの「エリア」を選ぶ画面（地方ごとに都道府県を並べる）
 * 出典: 要件定義書 3.4.2「絞り込みのエリア」、ワイヤーフレーム決定事項 83
 *
 * 【初心者向け】47 個から 1 つずつ選ぶのは大変なので、**地方の □ でまとめて選べる**ようにした。
 *   - 地方の □ … 全部入っていれば塗りつぶし、一部なら横棒、何も無ければ空
 *   - 都道府県 … 1 つずつ出し入れ
 * 何も選ばなければ「全部」。判断は regions.ts の純粋関数にあり、ここは並べるだけ（約束 13）。
 */
export function AreaPicker({ selected, onChange, onBack }: { selected: readonly string[]; onChange: (next: string[]) => void; onBack: () => void }) {
  return (
    <div className="flex flex-col gap-3" data-area-picker>
      <div className="flex items-center gap-2">
        <button type="button" onClick={onBack} className="inline-flex h-8 shrink-0 items-center gap-1 text-[12px] font-medium text-muted">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          絞り込み
        </button>
        <h3 className="flex-1 text-center text-[15px] font-bold text-ink">エリア</h3>
        <span className="w-[72px]" />
      </div>
      <p className="text-[11px] text-muted">地方の □ でその地方を全部、都道府県で 1 つずつ。選ばなければ全部</p>

      {REGIONS.map((region) => {
        const state = regionState(region, selected);
        return (
          <fieldset key={region.name} data-region={region.name}>
            <legend className="sr-only">{region.name}</legend>
            <label className="mb-1.5 flex items-center gap-2 text-[13px] font-bold text-ink">
              <input
                type="checkbox"
                checked={state === "all"}
                ref={(element) => {
                  // 一部だけ選んでいる状態は「横棒」で見せる（HTML の indeterminate は JS でしか付けられない）
                  if (element) element.indeterminate = state === "some";
                }}
                onChange={() => onChange(toggleRegion(region, selected))}
                aria-label={`${region.name}をすべて選ぶ`}
                className="h-[18px] w-[18px] accent-[var(--accent)]"
              />
              {region.name}
              {state !== "none" && <span className="text-[11px] font-medium text-muted">{state === "all" ? "全部" : "一部"}</span>}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {region.prefectures.map((name) => {
                const checked = selected.includes(name);
                return (
                  <label
                    key={name}
                    className={`cursor-pointer rounded-full border px-3 py-1.5 text-[12px] font-medium ${
                      checked ? "border-accent bg-accent text-white" : "border-line text-ink"
                    }`}
                  >
                    <input type="checkbox" checked={checked} onChange={() => onChange(togglePrefecture(name, selected))} className="sr-only" />
                    {name}
                  </label>
                );
              })}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
