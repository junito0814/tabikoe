"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { findBadgeDefinition } from "@/lib/badges/catalog";

/** 自動で閉じるまでの時間。複数件をまとめて1枚に出すので少し長め */
const AUTO_DISMISS_MS = 6000;

/**
 * F-BG Task5: バッジ新規獲得時のトースト
 * 出典: docs/tasks/badges/status-badges/05-badge-toast-notification.md
 *
 * 新規獲得が0件なら何も描画しない。複数件は1枚のトーストにまとめて全件表示する（獲得判定順）。
 * 通知一覧には残らない（3.9）。表示のみで、閉じても再表示されない。
 */
export function BadgeToast({
  badgeTypes,
  autoDismissMs = AUTO_DISMISS_MS,
}: {
  badgeTypes: string[];
  /** 0以下で自動クローズしない（テスト用） */
  autoDismissMs?: number;
}) {
  const [isOpen, setIsOpen] = useState(badgeTypes.length > 0);

  useEffect(() => {
    if (!isOpen || autoDismissMs <= 0) return;
    const timer = window.setTimeout(() => setIsOpen(false), autoDismissMs);
    return () => window.clearTimeout(timer);
  }, [isOpen, autoDismissMs]);

  const badges = badgeTypes
    .map((type) => findBadgeDefinition(type))
    .filter((badge) => badge !== undefined);

  if (!isOpen || badges.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-4 z-50 flex justify-center px-4"
    >
      <div className="flex w-full max-w-[360px] items-start gap-3 rounded-[12px] border border-[#C4703F]/30 bg-white px-4 py-3 shadow-[0_6px_24px_rgba(61,58,53,0.14)]">
        <span aria-hidden className="mt-0.5 text-[18px]">
          🏅
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-[#3D3A35]">
            {badges.length === 1 ? "バッジを獲得しました" : `${badges.length}個のバッジを獲得しました`}
          </p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {badges.map((badge) => (
              <li
                key={badge.type}
                className="rounded-full bg-[#C4703F]/[0.1] px-2.5 py-0.5 text-[12px] font-medium text-[#C4703F]"
              >
                {badge.label}
              </li>
            ))}
          </ul>
          <Link
            href="/badges"
            className="mt-1.5 inline-block text-[11px] font-medium text-[#9C9488] underline underline-offset-2"
          >
            バッジ一覧を見る
          </Link>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          aria-label="閉じる"
          className="shrink-0 text-[14px] leading-none text-[#9C9488]"
        >
          ×
        </button>
      </div>
    </div>
  );
}
