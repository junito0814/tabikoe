import Link from "next/link";

/**
 * 出典: #686（バッジ・アルバムに戻るボタンが無い）
 * 要件定義書 4.5.13「「×」と「戻る」の位置」・ワイヤーフレーム決定事項 80
 *
 * 画面から画面へ戻る導線。**左上に置き、戻り先の画面名を出す。**
 *
 * 【初心者向け】なぜ部品にしたか ── 同じ形の戻るが「行きたい」にだけ書かれていて、
 * バッジとアルバムには無かった（#686）。写しを増やすと、片方だけ直してズレる
 * （約束 14）。ここ 1 つにまとめ、3 画面から同じものを使う。
 *
 * ホーム画面から単独のアプリとして開くと**ブラウザの戻るが無い**ので、
 * この導線が無いとメニューバー以外に戻る手段が無くなる。
 */
export function BackLink({ href = "/mypage", label = "マイページ" }: { href?: string; label?: string }) {
  return (
    <Link href={href} className="inline-flex h-8 shrink-0 items-center gap-1 text-[12px] font-medium text-muted">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label}
    </Link>
  );
}
