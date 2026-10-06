"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useOutsideClose } from "@/lib/ui/use-outside-close";

/**
 * #770（2026-10-06）: 右上の「⋯」とその中身（共通部品）
 * 出典: Issue #770「「通報する」を右上の「⋯」へ移す」
 *       要件定義書 4.5.13（「×」と「戻る」の位置）・4.5.15
 *
 * 【初心者向け】「⋯ を押すと小さな一覧が開く」という同じ作りが、アルバム（#742・#750）・
 * しおり詳細・しおりの行・投稿詳細と**4 か所に書き写され**ていました。
 * 開閉・外をタップして閉じる・読み上げ用の `role` まで、どれも同じです。
 * 片方だけ直すとズレるので 1 つにまとめます（約束 14）。
 *
 * 主役ではない操作（通報する・削除・退出）をここへ入れると、
 * 画面の見出しに並ぶのは**その画面でいちばんすること**だけになります。
 */
export function MoreMenu({
  label = "その他",
  children,
  className,
  disabled = false,
}: {
  label?: string;
  children: ReactNode;
  className?: string;
  /** 処理中など、開かせたくないとき（しおりの行） */
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useOutsideClose<HTMLDivElement>(isOpen, () => setIsOpen(false));
  return (
    <div ref={rootRef} className={`relative ${className ?? ""}`} onClick={() => setIsOpen(false)}>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setIsOpen((open) => !open);
        }}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={label}
        disabled={disabled}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface text-[0.875rem] font-bold text-ink disabled:opacity-45"
      >
        ⋯
      </button>
      {isOpen && (
        <ul role="menu" className="absolute right-0 z-20 mt-1 min-w-[150px] overflow-hidden rounded-[10px] border border-line bg-surface py-1 shadow-card">
          {children}
        </ul>
      )}
    </div>
  );
}

/**
 * 「⋯」の中の 1 行。行き先があるものは `href`、その場で何かするものは `onClick`。
 * 取り返しのつかないもの（削除・退出）は `danger` で赤くする。
 */
export function MoreMenuItem({
  label,
  href,
  onClick,
  danger = false,
  disabled = false,
}: {
  label: string;
  href?: string;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  const classes = `flex w-full px-3 py-2 text-left text-[0.8125rem] hover:bg-tint disabled:opacity-45 ${danger ? "text-saved" : "text-ink"}`;
  return (
    <li role="presentation">
      {href ? (
        <Link role="menuitem" href={href} className={classes}>
          {label}
        </Link>
      ) : (
        <button type="button" role="menuitem" onClick={onClick} disabled={disabled} className={classes}>
          {label}
        </button>
      )}
    </li>
  );
}
