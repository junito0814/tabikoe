"use client";

import { useEffect, useRef } from "react";

/**
 * #789（2026-10-06）: 「外をタップしたら閉じる／Esc で閉じる」を 1 つにまとめた hook
 * 出典: Issue #789「時刻ピッカーが外をタップしても閉じず、他のメニューと重なる」
 *
 * 【初心者向け】開いているもの（メニュー・ピッカー）を閉じる方法は 2 つあります。
 *
 *   1. **外をタップする** … `document` 全体で `pointerdown` を見張り、
 *      触られた場所が「自分の中」でなければ閉じる
 *   2. **Esc キーを押す** … `document` 全体で `keydown` を見張る
 *
 * `DayMoveDropdown` は最初からこの 2 つを持っていましたが、`TimePicker10` は
 * 「クリア」「○○にする」を押したときしか閉じませんでした。そのため、時刻ピッカーを
 * 開いたまま「Day 1 ▾」を押すと**両方が開いたまま重なって**いました。
 *
 * 同じことを 2 か所に書かないよう（約束 14）、ここに切り出して両方から使います。
 *
 * ## 使い方
 *
 * ```tsx
 * const ref = useOutsideClose<HTMLDivElement>(isOpen, () => setIsOpen(false));
 * return <div ref={ref} className="relative"><button …/>{isOpen && <ul …/>}</div>;
 * ```
 *
 * ref は**開く引き金のボタンごと**包む箱に付けてください。ボタンを箱の外に出すと、
 * 「閉じる → ボタンの click で開き直す」が同じタップの中で起きて閉じなくなります。
 *
 * @param isOpen 開いているか。false の間は何も見張らない（閉じているのに毎回 document を見るのは無駄）
 * @param onClose 閉じるときに呼ぶ。毎回別の関数を渡しても見張りは張り直されない（ref に入れて最新を読む）
 */
export function useOutsideClose<T extends HTMLElement = HTMLDivElement>(isOpen: boolean, onClose: () => void) {
  const rootRef = useRef<T>(null);
  /*
   * 【初心者向け】`onClose` は親が毎回その場で作る関数（`() => setIsOpen(false)`）なので、
   * 描き直すたびに「別の関数」になります。これを依存配列にそのまま入れると、
   * **描き直すたびに見張りを外して付け直す**ことになります。ref に入れて「いつでも最新を読む」
   * ことで、見張りは開いている間 1 回だけ張れば済みます。
   */
  const onCloseRef = useRef(onClose);
  // 描き終わるたびに最新に入れ替える（描いている最中に ref を書くと React に怒られる）
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) onCloseRef.current();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  return rootRef;
}
