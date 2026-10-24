"use client";

import { useSyncExternalStore, type ReactNode } from "react";

/**
 * #1014（2026-10-24）: ブラウザ側だけで描く入れ物
 * 出典: Issue #1014「地図を 2 回目に開くとハイドレーションの不一致（React #418）が出る」
 *       要件定義書 4.5.11（読み込み中の見せ方）
 *
 * 【初心者向け】Next.js は画面を 2 回組み立てます。
 *   1. サーバーが HTML を作って送る
 *   2. ブラウザが同じ内容をもう一度組み立てて、操作できる状態にする（ハイドレーション）
 *
 * この 2 つは**同じ内容でなければなりません**。食い違うと React がエラーを出し、
 * その部分を丸ごと作り直します（ちらつきと無駄な描画になります）。
 *
 * ところが「**ブラウザにしか無いもの**」を見て中身を決める部品は、どうしても食い違います。
 * 地図の画面は `sessionStorage` に覚えた直前の位置で開くので、
 * **サーバーは「復元なし」、ブラウザは「復元あり」**で組み立ててしまいます。
 *
 * そこでこの入れ物は、**1 回目の描画では `fallback`（骨組み）だけを出す**ようにします。
 * サーバーもブラウザも 1 回目は骨組みなので、食い違いが起きません。
 * 本物は**マウントが終わってから**出します。
 *
 * 使っていい場面を限ります。**JavaScript が動かないと見えないもの**（地図など）だけ。
 * 文章や一覧をこれで包むと、サーバーで作った HTML が無駄になり、表示が遅くなります。
 */

/** 外から変わることが無いので、購読は何もしない（解除も何もしない） */
const NEVER_CHANGES = () => () => {};
/** ブラウザで読んだときの値 */
const ON_BROWSER = () => true;
/** サーバーと、ハイドレーションの 1 回目に使う値 */
const ON_SERVER = () => false;

export function ClientOnly({ fallback, children }: { fallback: ReactNode; children: ReactNode }) {
  /*
   * 【初心者向け】`useSyncExternalStore` の 3 つ目の引数は「**サーバー側の値**」です。
   * サーバーと**ブラウザの 1 回目**はこれを使うので、両方が `false`（骨組み）でそろいます。
   * ハイドレーションが終わると 2 つ目の引数が読まれて `true` になり、本物に差し替わります。
   *
   * `useEffect` で state を変える書き方もありますが、eslint（React Compiler）が
   * 「効果の中で state を変えると描き直しが連鎖する」として止めます。
   * この形は同じリポジトリの `MapScreen`（URL の取得）でも使っています。
   */
  const mounted = useSyncExternalStore(NEVER_CHANGES, ON_BROWSER, ON_SERVER);

  return <>{mounted ? children : fallback}</>;
}
