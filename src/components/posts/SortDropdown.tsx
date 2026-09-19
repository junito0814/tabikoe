"use client";

import { useEffect, useId, useRef, useState } from "react";
import { POST_SORT_LABELS, POST_SORTS, type PostSort } from "@/lib/posts/post-cards";

/**
 * post-timeline Task2: 並び替えのドロップダウン
 * 出典: docs/tasks/map-search/post-timeline/02-timeline-ui.md
 *       要件定義書 v3.0 3.4.3（「新着順 ▾」の 1 ボタン。3 つを横に並べない）
 *
 * 【初心者向け】ボタンを押すと下に小さなメニュー（listbox）が開き、選ぶとボタンの表示が変わる。
 * 外側クリックと Esc で閉じる。`aria-expanded` と `role="listbox"` を付けて、スクリーンリーダーにも
 * 「開閉するメニュー」だと伝える。
 */
export function SortDropdown<S extends string = PostSort>({
  value,
  onChange,
  className,
  options = POST_SORTS as unknown as readonly S[],
  labels = POST_SORT_LABELS as unknown as Record<S, string>,
}: {
  value: S;
  onChange: (sort: S) => void;
  className?: string;
  /** v3.1: 文脈で選択肢を切り替える（検索結果＝新着順／評価順／投稿数順、スポット別＝新着順／評価順／いいね順） */
  options?: readonly S[];
  labels?: Record<S, string>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={rootRef} className={`relative ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listId}
        aria-label={`並び替え: ${labels[value]}`}
        className="inline-flex h-8 items-center gap-1 rounded-full border border-line bg-surface px-3 text-[12px] font-semibold text-ink"
      >
        {labels[value]}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {isOpen && (
        <ul
          id={listId}
          role="listbox"
          aria-label="並び替え"
          className="absolute right-0 z-20 mt-1 min-w-[132px] overflow-hidden rounded-[10px] border border-line bg-surface py-1 shadow-card"
        >
          {options.map((option) => {
            const selected = option === value;
            return (
              <li key={option} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    setIsOpen(false);
                    if (!selected) onChange(option);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] ${selected ? "font-semibold text-accent" : "text-ink"} hover:bg-tint`}
                >
                  <span aria-hidden className={`inline-block h-2 w-2 rounded-full ${selected ? "bg-accent" : "border border-line"}`} />
                  {labels[option]}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
