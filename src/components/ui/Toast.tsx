"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * 共通: 画面下のトースト（数秒で消える短い知らせ。任意でリンクを 1 つ）
 * 出典: docs/wireframes.md（「Day 2 に移動しました [Day 2 を見る]」「大阪旅行 に保存しました [しおりを見る]」）
 *
 * 【初心者向け】state は親が持つ（`toast` が null なら何も出さない）。表示から AUTO_HIDE_MS 後に onClose を呼ぶ。
 * `role="status"` は「重要ではないが知らせたい」領域で、スクリーンリーダーが読み上げる。
 */
export const TOAST_AUTO_HIDE_MS = 4000;

export interface ToastMessage {
  text: string;
  action?: { label: string; href?: string; onClick?: () => void };
}

export function Toast({ toast, onClose }: { toast: ToastMessage | null; onClose: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onClose, TOAST_AUTO_HIDE_MS);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(60px+16px)] z-50 flex justify-center px-4 md:bottom-6">
      <div role="status" className="pointer-events-auto flex max-w-[420px] items-center gap-3 rounded-full bg-ink px-4 py-2.5 text-[13px] text-white shadow-card">
        <span className="min-w-0 truncate">{toast.text}</span>
        {toast.action &&
          (toast.action.href ? (
            <Link href={toast.action.href} onClick={onClose} className="shrink-0 font-bold text-[#9cc8f5] underline underline-offset-2">
              {toast.action.label}
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => {
                toast.action?.onClick?.();
                onClose();
              }}
              className="shrink-0 font-bold text-[#9cc8f5] underline underline-offset-2"
            >
              {toast.action.label}
            </button>
          ))}
      </div>
    </div>
  );
}
