/**
 * 出典: #712（「×」を右上に統一する）
 * 要件定義書 4.5.13・ワイヤーフレーム決定事項 80
 *
 * **重ねて出したもの（シート・モーダル）を閉じるのは、右上の × で揃える。**
 * 文字の「閉じる」は使わない。
 *
 * 【初心者向け】画面から画面へ戻るのは**左上の「← ラベル」**（`BackLink`）。
 * どちらも「この画面を離れる」操作なので、**同じ画面に 2 つ並べない**。
 *
 * 形が 2 か所に書かれるとズレるので、ここ 1 つにまとめた（約束 14）。
 * 触る指に合わせて当たり判定は 32px 以上にしてある。
 */
export function CloseButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="閉じる"
      data-close-button
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted ${className ?? ""}`}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    </button>
  );
}
