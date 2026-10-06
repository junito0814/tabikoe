"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { Sheet } from "./Sheet";

/**
 * #778（2026-10-06）: アプリ共通の「確認」シート
 * 出典: Issue #778「Bug 3: 確認がブラウザ標準のダイアログ（12 か所）」
 *
 * 【初心者向け】削除・退出・外すの確認は、これまで `window.confirm` でした。
 * ブラウザ標準の箱は
 *
 *   - iPhone では上に「**localhost:3000 の内容**」のようにサイトの URL が出る（アプリに見えない）
 *   - 文字の大きさも配色もアプリと合わず、**ダークにも追随しない**
 *   - 文言を「やめる／削除」のように選べない（「キャンセル／OK」固定）
 *
 * ので、`Sheet` で作った共通の確認に差し替えます。10 か所が同じ見た目になります。
 *
 * ## 使い方
 *
 * `window.confirm` と同じ「聞いて、はいなら進む」の形のまま書けるよう、**hook** にしています。
 *
 * ```tsx
 * const { confirm, confirmSheet } = useConfirm();
 *
 * const remove = async () => {
 *   if (!(await confirm({ title: "このコメントを削除しますか？", confirmLabel: "削除", danger: true }))) return;
 *   …
 * };
 *
 * return <>{confirmSheet}…</>;
 * ```
 *
 * `confirm(...)` は**押されるまで待つ**約束（Promise）を返します。`window.confirm` が
 * その場で止まって true／false を返していたのと、呼ぶ側から見た形は同じです。
 */
export interface ConfirmOptions {
  /** 「〈何を〉〈どうする〉か」の形で書く。例:「このコメントを削除しますか？」 */
  title: string;
  /** 補足（取り消せないこと、残るものなど）。無くてよい */
  description?: ReactNode;
  /** 右のボタンの文字。動詞にする。例:「削除」「外す」「退出」 */
  confirmLabel: string;
  /** 取り消せない操作なら true。右のボタンが赤くなる */
  danger?: boolean;
}

export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  /*
   * 【初心者向け】「押されたら教える」ための電話番号のようなもの。
   * confirm() を呼んだ時点ではまだ答えが無いので、答えを返す関数（resolve）をここに預け、
   * ボタンが押されたときに呼び出します。
   */
  const resolveRef = useRef<((answer: boolean) => void) | null>(null);

  const confirm = useCallback((next: ConfirmOptions) => {
    setOptions(next);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const answer = useCallback((value: boolean) => {
    setOptions(null);
    resolveRef.current?.(value);
    resolveRef.current = null;
  }, []);

  const confirmSheet = (
    <Sheet open={options !== null} title={options?.title ?? ""} onClose={() => answer(false)}>
      {options && (
        <div className="flex flex-col gap-4" data-confirm-sheet>
          {options.description && <p className="text-[13px] leading-[1.7] text-muted">{options.description}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => answer(false)}
              className="h-11 flex-1 rounded-[10px] border border-line bg-surface text-[14px] font-semibold text-ink"
            >
              やめる
            </button>
            <button
              type="button"
              onClick={() => answer(true)}
              className={`h-11 flex-1 rounded-[10px] text-[14px] font-bold text-white ${options.danger ? "bg-saved" : "bg-accent"}`}
            >
              {options.confirmLabel}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );

  return { confirm, confirmSheet };
}
