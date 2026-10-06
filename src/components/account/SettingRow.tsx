import Link from "next/link";
import type { ReactNode } from "react";

/**
 * #799（2026-10-06）: 設定の 1 行（iOS の「設定」と同じ形）
 * 出典: Issue #799「文字リンクを操作に使わない決まりを足し、アカウント画面を行の形にする」
 *       要件定義書 4.5.16「文字リンク（下線）の使い分け」
 *
 * 【初心者向け】アカウント画面は「画像を選択」「ログアウト」「退会する」が
 * **下線の文字リンク**でした。下線は Web ページの作法で、スマホのアプリでは
 * **行かボタン**にします（要件 4.5.16）。押せる範囲も広がり、押し間違いが減ります。
 *
 *   - **別の画面へ行く行** … 右に「›」。`href`（外部なら `external`）
 *   - **その場で何かする行** … 「›」を出さない。`onClick`
 *   - 取り返しのつかないもの（退会）は `danger` で赤
 */
export function SettingRow({
  label,
  value,
  href,
  onClick,
  danger = false,
  disabled = false,
}: {
  label: string;
  /** 右に小さく出す今の値（「たろう」「0 人」など） */
  value?: ReactNode;
  href?: string;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  const inner = (
    <>
      <span className={`flex-1 text-left text-[0.875rem] ${danger ? "text-saved" : "text-ink"}`}>{label}</span>
      {value !== undefined && <span className="shrink-0 text-[0.8125rem] text-muted">{value}</span>}
      {/* 行き先のある行だけ「›」。その場で何かする行には出さない（押したら画面が変わると誤解させない） */}
      {href !== undefined || onClick !== undefined ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0 text-muted">
          <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
    </>
  );
  const classes = "flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left disabled:opacity-45";
  if (href) {
    return (
      <li className="border-b border-line last:border-b-0">
        <Link href={href} className={classes}>
          {inner}
        </Link>
      </li>
    );
  }
  return (
    <li className="border-b border-line last:border-b-0">
      <button type="button" onClick={onClick} disabled={disabled} className={classes}>
        {inner}
      </button>
    </li>
  );
}

/** 行をまとめる箱（角丸の枠。iOS の設定の「組」と同じ） */
export function SettingGroup({ children }: { children: ReactNode }) {
  return <ul className="w-full overflow-hidden rounded-[12px] border border-line bg-surface">{children}</ul>;
}
