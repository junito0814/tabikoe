/**
 * #811: 「絞り込み」を開くボタン（3 本線の記号＋効いている数）
 * 出典: 要件定義書 4.5.15（言葉と記号の統一）・3.4.2
 *
 * 【初心者向け】探すモード（NearbyVoices）はこの記号、検索結果は「絞り込み（2）」という
 * 文字のボタンで、同じ操作に 2 つの見た目があった。記号に揃える（決定事項 83）。
 *   - 文字より小さく、スマホの見出しの行で場所を取らない
 *   - 効いているかどうかが**色と数**で分かる（文字だと「（2）」を読まないと分からない）
 * 読み上げには「絞り込み」の名前を残すので、意味は失われない。
 */
export function FilterButton({ count, expanded = false, onClick, className, dataAttr }: {
  /** 効いている条件の数。0 なら印を出さない */
  count: number;
  expanded?: boolean;
  onClick: () => void;
  className?: string;
  /** 既存のテストが使っている目印（例: data-nearby-filter）を残すため */
  dataAttr?: string;
}) {
  const isActive = count > 0;
  return (
    <button
      type="button"
      aria-label="絞り込み"
      aria-haspopup="dialog"
      aria-expanded={expanded}
      onClick={onClick}
      {...(dataAttr ? { [dataAttr]: true } : {})}
      data-filter-button
      className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
        isActive ? "border-accent bg-accent text-white" : "border-line bg-surface text-ink"
      } ${className ?? ""}`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
      {isActive && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-ink px-1 text-[10px] font-bold text-on-ink">
          {count}
        </span>
      )}
    </button>
  );
}
