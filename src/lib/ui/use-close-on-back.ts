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
 */
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

    const onPopState = () => {
      pushedRef.current = false;
      onCloseRef.current();
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      if (pushedRef.current) {
        pushedRef.current = false;
        window.history.back();
      }
    };
  }, [open]);
}
