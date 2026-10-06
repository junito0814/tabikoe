import type { ReactNode } from "react";

/**
 * #812（2026-10-06）: 「選ぶ」部品を 1 つにまとめた丸いボタン型の `<select>`
 * 出典: Issue #812「自前のドロップダウンをやめ、ブラウザ標準の select に統一する」
 *       要件定義書 4.5.15（記号と文言の統一）
 *
 * 【初心者向け】タビコエには「選ぶ」部品が **2 種類**ありました。
 *
 *   1. 自前のリスト（`SortDropdown`・`DayMoveDropdown`）── ボタンを押すと下に小さなメニューが開く
 *   2. ブラウザ標準の `<select>`（アルバムの並び順・移動手段など）
 *
 * 見た目はそっくりでも、**押したあとの挙動がまったく違います**。標準の `<select>` は
 * スマホで **OS の選択画面**（iPhone なら下から出るホイール）が開き、指で押しやすく、
 * 端末の文字サイズ設定にも追随します。自前のリストはどちらも効きません。
 * そこで標準の `<select>` に揃え、**見た目だけ**をここで引き受けます。
 *
 * `appearance: none` でブラウザ既定の矢印を消し、同じ位置に自分の `⌄` を置きます
 * （`pointer-events-none` なので、矢印を押しても `<select>` が開きます）。
 *
 * **文字は 1rem（既定で 16px）です。** `globals.css` が `select` を一律 `max(1rem, 16px)` にしているため
 * （iOS は 16px 未満の入力欄に触ると勝手に画面を拡大し、戻らない。要件 4.5.12 の 1）。
 * ここに `text-[0.75rem]` と書いても効きません。アプリに前からある `<select>`
 * （アルバムの並び順・移動手段）も同じ 16px なので、これで見た目がそろいます。
 */
export function Select<T extends string>({
  value,
  onChange,
  options,
  label,
  ariaLabel,
  disabled = false,
  className,
}: {
  value: T;
  onChange: (next: T) => void;
  options: readonly T[];
  /** 選択肢の文字。省略すると値をそのまま出す */
  label?: (option: T) => ReactNode;
  /** 読み上げ用の名前（見出しを横に置かないので必須） */
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={`relative inline-flex ${className ?? ""}`}>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        aria-label={ariaLabel}
        disabled={disabled}
        className="h-8 max-w-full appearance-none truncate rounded-full border border-line bg-surface pl-3 pr-7 text-[1rem] font-semibold text-ink disabled:opacity-45"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {label ? label(option) : option}
          </option>
        ))}
      </select>
      {/* ブラウザ既定の矢印の代わり。押しても下の <select> が開くよう pointer-events-none */}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink">
        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
