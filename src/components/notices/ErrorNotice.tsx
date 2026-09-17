"use client";

/**
 * 共通エラー表示 Task1: 共通エラー表示コンポーネントの実装
 * 出典: docs/tasks/shared-ui/error-display/01-error-notice-component.md
 *
 * エリア内表示・画面全体表示の両方に使える最小限のエラー通知。
 * `onRetry`未指定でも`retryable`をtrueにすればページ再読み込みで代用する
 * （Server ComponentからはClient Componentへ関数propを渡せないため）。
 */
interface ErrorNoticeProps {
  message: string;
  onRetry?: () => void;
  retryable?: boolean;
  className?: string;
}

export function ErrorNotice({ message, onRetry, retryable, className }: ErrorNoticeProps) {
  const showRetryButton = Boolean(onRetry) || retryable;
  const handleRetry = onRetry ?? (() => window.location.reload());

  return (
    <div
      className={`flex items-center gap-2 rounded-lg border border-accent/25 bg-accent/[0.08] px-3.5 py-2.5 ${className ?? ""}`}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="shrink-0">
        <circle cx="12" cy="12" r="9" stroke="var(--accent)" strokeWidth="1.8" />
        <line x1="12" y1="8" x2="12" y2="13" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="12" cy="16.5" r="1" fill="var(--accent)" />
      </svg>
      <span className="flex-1 text-[13px] leading-[1.5] text-accent">{message}</span>
      {showRetryButton && (
        <button
          type="button"
          onClick={handleRetry}
          className="shrink-0 text-[12px] font-semibold text-accent underline underline-offset-2"
        >
          再読み込み
        </button>
      )}
    </div>
  );
}
