"use client";

import { useEffect, useId, type ReactNode } from "react";

/**
 * 共通: 下から出るシート（パソコン幅では中央のダイアログ）
 * 出典: docs/wireframes.md（絞り込みシート・保存先シート・期間の変更など）
 *
 * 【初心者向け】背景の暗い層（タップで閉じる）＋本体。Esc でも閉じる。
 * `role="dialog"` と `aria-modal` を付け、見出しを `aria-labelledby` で結ぶ（スクリーンリーダー向け）。
 * 中身は children に任せ、このファイルは「開閉と枠」だけを担当する。
 */
export function Sheet({
  open,
  title,
  onClose,
  children,
  footer,
  className,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center md:items-center" data-sheet>
      <button type="button" aria-label="閉じる" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative flex max-h-[85dvh] w-full max-w-[520px] flex-col rounded-t-[16px] bg-surface shadow-card md:rounded-[16px] ${className ?? ""}`}
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h2 id={titleId} className="text-[15px] font-bold text-ink">
            {title}
          </h2>
          <button type="button" onClick={onClose} className="text-[12px] font-medium text-muted underline underline-offset-2">
            閉じる
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4">{children}</div>
        {footer && <div className="border-t border-line px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>
  );
}
