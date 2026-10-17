"use client";

import { useState } from "react";
import { VISIT_FINDING_GROUPS, VISIT_FINDING_LABELS } from "@/lib/spots/visit-findings";
import { visitFindingAge } from "@/lib/spots/visit-findings-age";
import type { VisitFindingSummary } from "@/lib/spots/visit-findings-db";

/**
 * #929: スポット画面の「行ってわかったこと」
 * 出典: Issue #929、要件定義書 4.5.19・3.4.2、ワイヤーフレーム決定事項 99
 *
 * 【初心者向け】**既定は畳んで 1 行**です。スポット画面は上 1/3 が地図で、見出し・操作・
 * Google の公式情報・投稿一覧が既に並んでいます。ここを開いたまま置くと、**本体の投稿一覧が
 * 画面の外へ出ます**。
 *
 * 開いたときの見た目は**投稿画面とまったく同じ**（見出し左・チップ右・同じ単語）にしてあります。
 * 言い換えの対応表を持たずに済み、押した言葉がそのまま返ってくるので迷いません（約束 14）。
 *
 * **0 件の項目は出しません**（呼ぶ側が渡しません）。「ペット不可」とは絶対に書かない、の裏返しです。
 */
export function VisitFindingsPanel({ summaries }: { summaries: VisitFindingSummary[] }) {
  const [isOpen, setIsOpen] = useState(false);
  if (summaries.length === 0) return null;

  const total = summaries.reduce((sum, item) => sum + item.count, 0);
  const found = new Map(summaries.map((item) => [item.finding, item]));

  return (
    <div className="rounded-[10px] border border-line bg-tint">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className="flex min-h-11 w-full items-center gap-2 px-3 py-2.5 text-[0.75rem] font-semibold text-muted"
      >
        行ってわかったこと
        <span className="text-[0.8125rem] text-ink">{total} 件</span>
        {/* 開いても閉じても、見出し・件数・記号の位置を動かさない */}
        <span className="ml-auto text-muted" aria-hidden>
          {isOpen ? "⌃" : "⌄"}
        </span>
      </button>

      {isOpen && (
        <div className="border-t border-line px-3 pb-3 pt-1">
          {VISIT_FINDING_GROUPS.map((group) => {
            const items = group.findings.flatMap((finding) => {
              const item = found.get(finding);
              return item ? [item] : [];
            });
            // 報告のあるグループだけ出す（空の見出しを並べない）
            if (items.length === 0) return null;
            return (
              <div key={group.key} className="flex items-start gap-2.5 pt-2">
                <span className="w-[4.5rem] shrink-0 pt-1.5 text-[0.6875rem] font-semibold text-muted">{group.label}</span>
                <div className="flex min-w-0 flex-wrap gap-1.5">
                  {items.map((item) => (
                    <span
                      key={item.finding}
                      className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[0.75rem] text-ink"
                    >
                      {VISIT_FINDING_LABELS[item.finding]}
                      <b className="font-bold text-accent tabular-nums">{item.count}</b>
                      <span className="text-[0.625rem] text-muted">{visitFindingAge(item.latestAt)}</span>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
