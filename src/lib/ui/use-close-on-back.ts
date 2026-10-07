"use client";

import { useEffect, useRef } from "react";

/**
 * #796（2026-10-06）: 開いている間だけ履歴を 1 つ積み、戻るキーで「閉じるだけ」にする
 * 出典: Issue #796「Bug 4: Android の戻るキーでシートが閉じず、画面ごと戻る」
 *
 * 【初心者向け】スマホの作法では、何かが開いているときの戻るキーは「**それを閉じる**」です
 * （LINE・Instagram など）。タビコエはシートを開いた状態で戻るキーを押すと、
 * シートが開いたまま**画面ごと前のページへ戻って**いました。
 *
 * 仕組みはこうです。
 *
 *   1. 開くとき `history.pushState` で履歴を 1 つ積む（URL は変えない。見た目も変わらない）
 *   2. 戻るキーが押されると `popstate` が来る。積んだ 1 つが取り除かれるだけなので、
 *      **画面はそのまま**。ここで閉じる
 *   3. × や背景タップで閉じたときは `history.back()` で自分が積んだ分を戻す
 *      （戻さないと、閉じたあとの戻るキーが 1 回空振りする）
 *
 * iOS の端からのスワイプも同じ `popstate` なので、同じように効きます。
 *
 * `Sheet` 1 か所に入れれば全シートに効きます（約束 14）。通知のモーダル・写真のモーダルも同じ hook を使います。
 *
 * ## 重なって開いているとき（#874 で見つけた）
 *
 * コメントのシートの中から削除の確認シートを開くと、**2 つ積まれます**。この手当てが無いと
 *
 *   - 戻るキーを 1 回押しただけで**両方**閉じる（どちらの `popstate` も反応するため）
 *   - 確認を × で閉じると、その後片づけの `history.back()` に**外側も反応して**一緒に閉じる
 *
 * ということが起きます。そこで 2 つ数えています。
 *
 *   - `openDepth` … いま何枚開いているか。`popstate` で閉じるのは**いちばん上の 1 枚だけ**
 *   - `programmaticBacks` … 後片づけで自分が呼んだ `history.back()` の回数。
 *     それで来た `popstate` は**誰も反応しない**（利用者が押した戻るではないため）
 */

/** いま開いている枚数（重なり順。いちばん上が最大） */
let openDepth = 0;
/** 後片づけで自分が呼んだ `history.back()` の回数。この分の popstate は読み飛ばす */
let programmaticBacks = 0;

/**
 * テスト用。数えているものを初期値に戻す。
 *
 * 【初心者向け】この 2 つはファイルの外（モジュール）に置いた変数なので、**テストをまたいで残ります**。
 * 前のテストでシートを開いたまま終わると、次のテストで「自分より上に 1 枚ある」と判断されて
 * 戻るキーが効かなくなります。各テストの頭でここを呼んで揃えます。
 */
export function __resetOverlayStackForTest(): void {
  openDepth = 0;
  programmaticBacks = 0;
}

export function useCloseOnBack(open: boolean, onClose: () => void): void {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  /*
   * 【初心者向け】「自分が積んだ 1 つがまだ残っているか」。
   * 戻るキーで閉じたときは**もう取り除かれている**ので、後片づけで `history.back()` を
   * 呼んではいけません（呼ぶと前の画面まで戻ってしまう）。
   */
  const pushedRef = useRef(false);

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    window.history.pushState({ ...window.history.state, tabikoeOverlay: true }, "");
    pushedRef.current = true;
    openDepth += 1;
    const myDepth = openDepth;

    const onPopState = () => {
      // 後片づけで自分たちが呼んだ back は、利用者の操作ではないので読み飛ばす
      if (programmaticBacks > 0) {
        programmaticBacks -= 1;
        return;
      }
      // 自分より上に開いているものがあれば、閉じるのはそちら
      if (myDepth !== openDepth) return;
      openDepth -= 1;
      pushedRef.current = false;
      onCloseRef.current();
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      if (pushedRef.current) {
        pushedRef.current = false;
        openDepth -= 1;
        programmaticBacks += 1;
        window.history.back();
      }
    };
  }, [open]);
}
