"use client";

/**
 * photo-view Task2: 「投稿／写真」の切替
 * 出典: docs/tasks/map-search/photo-view/02-view-toggle-ui.md
 *       要件定義書 v3.0 3.4.2
 *
 * 【初心者向け】radio 風の 2 ボタン。選ぶと親が `?view=photos` を URL に付け外しする（状態は URL に持つ）。
 * 絞り込み・並び替えは両方の表示で共通に効く。
 */
export type ListView = "posts" | "photos";

export function parseListView(value: string | null | undefined): ListView {
  return value === "photos" ? "photos" : "posts";
}

export function ViewToggle({ value, onChange, className }: { value: ListView; onChange: (view: ListView) => void; className?: string }) {
  const options: { view: ListView; label: string }[] = [
    { view: "posts", label: "投稿" },
    { view: "photos", label: "写真" },
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
            className={`h-7 rounded-full px-3 text-[12px] font-semibold ${selected ? "bg-ink text-white" : "text-muted"}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
