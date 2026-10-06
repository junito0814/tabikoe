import Link from "next/link";

/**
 * #807: 「＋ ここに投稿」ボタンの見た目
 * 出典: 要件定義書 3.3.8（投稿の起点）・4.5.15（言葉の統一: 「ここに投稿」）
 *
 * 【初心者向け】同じ青い丸ボタンが、地図画面（右下）と、ホーム・計画・マイページの右下（PostFab）に出る。
 * 形を 2 か所に書くとズレるので、ここ 1 つにまとめた（約束 14）。
 *   - `href` を渡すとリンク（地図画面。行き先は地図の中心で決まっている）
 *   - `onClick` を渡すとボタン（PostFab。押してから位置情報を取る）
 */
export function PostHereButton({ href, onClick, disabled = false, className }: { href?: string; onClick?: () => void; disabled?: boolean; className?: string }) {
  const base = `flex h-11 items-center gap-1.5 rounded-full bg-accent px-4 text-[0.8125rem] font-bold text-white shadow-[0_4px_20px_rgba(47,127,216,0.30)] ${className ?? ""}`;
  const inner = (
    <>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
      ここに投稿
    </>
  );
  if (href) {
    return (
      <Link href={href} className={base} data-post-here>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`${base} disabled:opacity-60`} data-post-here>
      {inner}
    </button>
  );
}
