"use client";

import type { ListView } from "@/lib/search/list-view";

/**
 * photo-view Task2: 「投稿／写真」の切替
 * 出典: docs/tasks/map-search/photo-view/02-view-toggle-ui.md
 *       要件定義書 v3.0 3.4.2
 *
 * 【初心者向け】radio 風の 2 ボタン。選ぶと親が `?view=photos` を URL に付け外しする（状態は URL に持つ）。
 * 絞り込み・並び替えは両方の表示で共通に効く。値の型と読み取り（parseListView）は lib/search/list-view.ts
 * （サーバーからも使うため、この "use client" ファイルには置かない）。
 */
export type { ListView };
export function ViewToggle({
  value,
  onChange,
  showMap = false,
  className,
}: {
  value: ListView;
  onChange: (view: ListView) => void;
  /** #681: 検索結果のときだけ「地図」を出す（スポット別では出さない） */
  showMap?: boolean;
  className?: string;
}) {
  const options: { view: ListView; label: string }[] = [
    { view: "posts", label: "投稿" },
    { view: "photos", label: "写真" },
    ...(showMap ? [{ view: "map" as const, label: "地図" }] : []),
  ];
  return (
    <div role="radiogroup" aria-label="表示" className={`inline-flex rounded-full border border-line bg-surface p-0.5 ${className ?? ""}`}>
      {options.map((option) => {
        const selected = option.view === value;
        return (
          <button
            key={option.view}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => !selected && onChange(option.view)}
            className={`h-7 rounded-full px-3 text-[12px] font-semibold ${selected ? "bg-ink text-on-ink" : "text-muted"}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
