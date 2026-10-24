"use client";

import { usePathname } from "next/navigation";
import { shouldShowMenuBar } from "./menu-bar-config";

/**
 * #1024（2026-10-24）: メニューバーが**届く前から**、その 60px を空けておく部品。
 * 出典: Issue #1024「ログイン後、読み込みが終わって本体が出るときに右下から斜めに出てくる」
 *
 * 【初心者向け】`layout.tsx` の下余白は `has-[[data-menu-bar]]:pb-[60px]` ＝
 * 「メニューバーが**ある**なら空ける」と書いてあります。ところが #901 でバーは
 * `<Suspense>` の中に移り、**後から届く**ようになりました。つまり届いた瞬間に
 * 画面が 60px 動きます。しかもその 10ms 後に画面の切り替わり（ViewTransition）が
 * 始まるので、**動いている最中のレイアウトが写し取られます**。
 * iPhone ではこれが「本体が右下から斜めに出てくる」に見えていました。
 *
 * そこで、バーが届くまでのあいだ **`data-menu-bar` を名乗るだけの空の印**を置きます。
 * 余白は最初から 60px のままになり、バーが届いても**動くものがありません**。
 *
 * 出す・出さないの判定は `shouldShowMenuBar()` をそのまま使います（約束 14 ＝
 * 同じ判定を 2 か所に書かない）。ログイン状態はまだ分からないので `true` として
 * 見積もります。**多めに見積もっても辻褄が合う**のは次の理由です。
 *   - 未ログインで `/posts/[id]`・`/spots/[id]` を開いたときは、バーの代わりに
 *     `GuestBand` が出ます。**こちらも 60px**（`has-[[data-guest-band]]:pb-[60px]`）なので、
 *     印と入れ替わるだけで余白は変わりません
 *   - 未ログインのホーム（`/`）だけは、どちらも出ません。ここは 60px ぶん縮みますが、
 *     **起動の覆いが出ている 1 秒のあいだ**に起きるので目に入りません
 *
 * 見た目は持ちません（`hidden`）。空けるのは `layout.tsx` の余白の仕事で、
 * この印は「バーが来る」ことを CSS に伝えるためだけにあります。
 */
export function MenuBarSpace() {
  const pathname = usePathname();

  if (!shouldShowMenuBar(pathname, true)) {
    return null;
  }

  return <div data-menu-bar hidden />;
}
