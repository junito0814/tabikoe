"use client";

import { useEffect, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useCloseOnBack } from "@/lib/ui/use-close-on-back";
import { usePullToClose } from "@/lib/ui/use-pull-to-close";
import { CloseButton } from "./CloseButton";
import { SheetHandleBar } from "./SheetHandleBar";

/**
 * 共通: 下から出るシート（パソコン幅では中央のダイアログ）
 * 出典: docs/wireframes.md（絞り込みシート・保存先シート・期間の変更など）
 *
 * 【初心者向け】背景の暗い層（タップで閉じる）＋本体。Esc でも閉じる。
 *
 * #796（2026-10-06）: **Android の戻るキー**でも閉じる（画面ごと戻らない）。`use-close-on-back` 参照。
 * #804（2026-10-06）: 上に**取っ手の棒**を出し、**下に 80px 引いても閉じる**。`use-pull-to-close` 参照。
 * どちらもここ 1 か所に入れてあるので、アプリ中のすべてのシートに効きます（約束 14）。
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
  useCloseOnBack(open, onClose);
  const { offset, handleProps, contentProps } = usePullToClose(onClose);
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;
  // Bug #473: メニューバー（z-40）より上に出す（同じ値だと下から出るシートの下 60px が隠れる）。さらに、上 1/3 地図＋下 2/3
  // シート（MapSheetLayout）の中から開くと親の `relative z-10` が重なり順の枠になり fixed でも外に出られないので、
  // createPortal で body 直下に描く。メニューバーは隠さず残す（バーがあるときはスマホで下 60px、パソコンで左 200px を空ける）。
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center [body:has([data-menu-bar])_&]:bottom-[60px] md:[body:has([data-menu-bar])_&]:bottom-0 md:[body:has([data-menu-bar])_&]:left-[200px]" data-sheet>
      <button type="button" aria-label="閉じる" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={offset > 0 ? { transform: `translateY(${offset}px)` } : undefined}
        className={`relative flex max-h-[85dvh] w-full max-w-[520px] flex-col rounded-t-[16px] bg-surface shadow-card md:rounded-[16px] ${className ?? ""}`}
      >
        {/*
          * #804: 取っ手の棒。iOS のシートと同じ「下に引けば閉じる」の合図。
          * 掴める範囲は 32px 以上（h-8）。パソコン幅（中央のダイアログ）では出さない。
          * 中身のスクロールとは取り合わない ── 棒はスクロールする場所の外にあるため。
          */}
        <button
          type="button"
          {...handleProps}
          onClick={onClose}
          aria-label="閉じる"
          data-sheet-pull-handle
          className="flex h-8 w-full shrink-0 touch-none items-center justify-center md:hidden"
        >
          <SheetHandleBar />
        </button>
        <div className="flex items-center justify-between px-4 pb-2 pt-1 md:pt-4">
          <h2 id={titleId} className="text-[0.9375rem] font-bold text-ink">
            {title}
          </h2>
          {/* #712: 文字の「閉じる」をやめ、右上の × に揃えた（要件 4.5.13） */}
          <CloseButton onClick={onClose} />
        </div>
        {/* #885: 中身のどこからでも下にスライドして閉じられる（いちばん上にいるときだけ引き始める） */}
        <div {...contentProps} className="flex-1 overflow-y-auto px-4 pb-4">
          {children}
        </div>
        {footer && <div className="border-t border-line px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
