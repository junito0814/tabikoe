/**
 * 出典: #695（削除ボタンをゴミ箱の印にする。全画面）
 * ワイヤーフレーム決定事項 74④・要件定義書 4.5.13
 *
 * **削除は「削除」の文字ではなくゴミ箱の印だけにする。** 文字は添えない。
 *
 * 【初心者向け】なぜ部品にしたか ── 同じゴミ箱が 5 か所に要るので、形が
 * バラバラにならないよう 1 つにまとめた（約束 14）。
 *
 * 気をつけていること。
 *   - **読み上げ用の名前（`aria-label`）には「削除」を残す**。印だけだと耳では分からない
 *   - **確認ダイアログの文言は変えない**（取り消せない操作の説明は文字で残す）
 *   - × と間違えないよう、**右上には置かない**（要件 4.5.13）
 */
export function TrashButton({
  onClick,
  label,
  disabled = false,
  busy = false,
  className,
}: {
  onClick: () => void;
  /** 読み上げ用。「この投稿を削除」のように、何を消すかまで書く */
  label: string;
  disabled?: boolean;
  /** 消している最中（押せなくし、薄くする） */
  busy?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      aria-label={label}
      aria-busy={busy || undefined}
      data-trash-button
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-saved disabled:opacity-45 ${className ?? ""}`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
