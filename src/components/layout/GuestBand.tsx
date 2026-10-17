import Link from "next/link";
import { CATCHPHRASE } from "@/lib/terms";

/**
 * #951（2026-10-17）: 共有リンクを未ログインで開いたときに、下へ固定で出す帯
 * 出典: Issue #951、要件定義書 4.5.18、ワイヤーフレーム決定事項 97
 *
 * 【初心者向け】未ログインではメニューバーを出しません（出すと未読件数の API が 401 を返し、
 * 見に来た投稿からログイン画面へ締め出されます。#583）。その代わりに置くのがこの帯です。
 *
 * **「ログインしてください」とは書きません。** 共有された人は「見に来ただけ」で、
 * 何かを禁じられたわけではないからです。出すのは SC-00・SC-01 と**同じキャッチフレーズ**と
 * 「はじめる」の 1 つだけ（言い方を 2 通り作らない。要件 4.5.18）。
 *
 * 位置はメニューバーと同じ下端固定。押すとログイン画面へ行き、`redirect_to` で**この画面に戻ります**。
 */
export function GuestBand({ returnTo }: { returnTo: string }) {
  return (
    /*
      * 高さはメニューバーと同じ 60px にそろえる。
      *
      * 【初心者向け】画面に貼り付く（`fixed`）ものは、そのぶん**本文の下に余白を空けないと
      * 最後の部分が隠れます**。メニューバーは `layout.tsx` の `has-[[data-menu-bar]]:pb-[60px]`
      * で空けているので、この帯も同じ 60px にして同じ仕組みに乗せます（約束 14）。
      * 実際、空ける前は帯がコメント欄の上に重なって押せませんでした。
      */
    <div data-guest-band className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface">
      <div className="flex h-[60px] items-center gap-3 px-4">
        <p className="min-w-0 flex-1 text-[0.75rem] leading-[1.6] text-muted">{CATCHPHRASE}</p>
        {/* #784: 指で押す的は 32px 以上。ここは主役の一手なので 40px（h-10） */}
        <Link
          href={`/login?redirect_to=${encodeURIComponent(returnTo)}`}
          className="flex h-10 shrink-0 items-center rounded-full bg-accent px-5 text-[0.8125rem] font-bold text-white"
        >
          はじめる
        </Link>
      </div>
    </div>
  );
}
