import Link from "next/link";

/**
 * 出典: #686（バッジ・アルバムに戻るボタンが無い）
 * 要件定義書 4.5.13「「×」と「戻る」の位置」・4.5.15（記号と文言の統一）・ワイヤーフレーム決定事項 80・83
 *
 * 画面から画面へ戻る導線。**左上に置き、戻り先の画面名を出す。**
 *
 * 【初心者向け】なぜ部品にしたか ── 同じ形の戻るが「行きたい」にだけ書かれていて、
 * バッジとアルバムには無かった（#686）。写しを増やすと、片方だけ直してズレる
 * （約束 14）。ここ 1 つにまとめ、全画面から同じものを使う。
 *
 * ホーム画面から単独のアプリとして開くと**ブラウザの戻るが無い**ので、
 * この導線が無いとメニューバー以外に戻る手段が無くなる。
 *
 * #813（2026-10-06）: 実際には **21 ファイルが自前で ‹ や ← を描いて**いて、
 * 同じ「戻る」が 4 とおりの見た目になっていました（薄い灰色の ‹ ／ 下線付きの「← 一覧」／
 * 白い丸の ‹ ／ 枠付きの丸いボタン）。全部ここへ寄せます。
 *
 * ## 2 つの見た目
 *
 * | `variant` | どこで | 見た目 |
 * | --- | --- | --- |
 * | `default` | 普通の画面（白い背景の上） | 薄い灰色の「‹ ラベル」 |
 * | `floating` | **地図の上**（背景が写真や地図で読めない） | 白い丸みの札に濃い文字＋影 |
 */
export function BackChevron({ size = 16, strokeWidth = 2 }: { size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export type BackLinkVariant = "default" | "floating";

const STYLES: Record<BackLinkVariant, string> = {
  default: "inline-flex h-8 shrink-0 items-center gap-1 text-[0.75rem] font-medium text-muted",
  floating: "inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-surface px-3 text-[0.75rem] font-semibold text-ink shadow-card",
};

export function BackLink({
  href = "/mypage",
  label = "マイページ",
  variant = "default",
  onClick,
  className,
}: {
  href?: string;
  label?: string;
  variant?: BackLinkVariant;
  /** 行き先が決まっていないとき（ブラウザの戻る）。渡すと `<button>` になる */
  onClick?: () => void;
  className?: string;
}) {
  const classes = `${STYLES[variant]} ${className ?? ""}`;
  const inner = (
    <>
      <BackChevron size={variant === "floating" ? 14 : 16} strokeWidth={variant === "floating" ? 2.2 : 2} />
      {label}
    </>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classes}>
        {inner}
      </button>
    );
  }
  return (
    <Link href={href} className={classes}>
      {inner}
    </Link>
  );
}
