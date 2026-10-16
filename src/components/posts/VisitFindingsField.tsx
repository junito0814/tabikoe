"use client";

import { useState } from "react";
import { VISIT_FINDING_GROUPS, VISIT_FINDING_LABELS, type VisitFinding } from "@/lib/spots/visit-findings";

/**
 * #929: 投稿画面の「行ってわかったこと（任意）」
 * 出典: Issue #929、要件定義書 4.5.19・3.3.1、ワイヤーフレーム決定事項 99
 *
 * 【初心者向け】**既定は畳んで 1 行**です。ほとんどの人には当てはまらない欄なので、
 * 開いたまま置くとフォームが縦に伸びて、本題（写真とひとこと）が画面の外に出ます
 * （投稿画面は上 1/3 が地図なので、使える高さが少ない）。選んでいれば「N つ選択中」と出します。
 *
 * **グループの見出しが動詞を持つので、項目は単語で済みます。**
 * 「入れた ＞ 車椅子」は「車椅子で入れた」以外に読みようがありません。
 * チップの形は**絞り込みシートと同じ**にし、**絵文字は付けません**（要件 4.5.14）。
 */
export function VisitFindingsField({
  value,
  onChange,
}: {
  value: readonly VisitFinding[];
  onChange: (next: VisitFinding[]) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selected = new Set(value);

  const toggle = (finding: VisitFinding) => {
    const next = new Set(selected);
    if (next.has(finding)) next.delete(finding);
    else next.add(finding);
    onChange([...next]);
  };

  return (
    <div className="rounded-[10px] border border-line bg-surface">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className="flex min-h-11 w-full items-center gap-2 px-3 py-2.5 text-[0.8125rem] font-semibold text-ink"
      >
        行ってわかったこと（任意）
        {selected.size > 0 && <span className="ml-auto text-[0.75rem] font-semibold text-accent">{selected.size} つ選択中</span>}
        <span className={`text-muted${selected.size > 0 ? "" : " ml-auto"}`} aria-hidden>
          {isOpen ? "⌃" : "⌄"}
        </span>
      </button>

      {isOpen && (
        <div className="border-t border-line px-3 pb-3 pt-2">
          {VISIT_FINDING_GROUPS.map((group) => (
            <div key={group.key} className="flex items-start gap-2.5 pt-2">
              {/* 見出しは左。チップは右に流す（縦を使わないため） */}
              <span className="w-[4.5rem] shrink-0 pt-1.5 text-[0.6875rem] font-semibold text-muted">{group.label}</span>
              <div className="flex min-w-0 flex-wrap gap-1.5">
                {group.findings.map((finding) => {
                  const checked = selected.has(finding);
                  return (
                    <label
                      key={finding}
                      className={`cursor-pointer rounded-full border px-3 py-1.5 text-[0.75rem] font-medium ${
                        checked ? "border-accent bg-tint text-accent" : "border-line text-ink"
                      }`}
                    >
                      <input type="checkbox" checked={checked} onChange={() => toggle(finding)} className="sr-only" />
                      {VISIT_FINDING_LABELS[finding]}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
          <p className="mt-2.5 text-[0.6875rem] leading-[1.6] text-muted">
            当てはまるものだけ選んでください。選ばなくても投稿できます
          </p>
        </div>
      )}
    </div>
  );
}
