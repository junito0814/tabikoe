import { act, fireEvent, waitFor } from "@testing-library/react";

/**
 * #778（2026-10-06）: 確認シート（`useConfirm`）をテストから「はい」と答えさせる道具
 * 出典: Issue #778「Bug 3: 確認がブラウザ標準のダイアログ（12 か所）」
 *
 * 【初心者向け】`window.confirm` だったころは `vi.spyOn(window, "confirm")` で
 * 答えを決められました。シートになったので、代わりに**出てきたボタンを押します**。
 * 同じ 5 行をテストごとに書き写さないよう（約束 14）ここに置きます。
 *
 * ```ts
 * fireEvent.click(screen.getByRole("button", { name: "削除" }));
 * await acceptConfirm(); // 確認シートの右のボタンを押す
 * ```
 */
const SHEET = "[data-confirm-sheet]";

/** 確認シートが出るのを待ち、右のボタン（削除・外す・退出など）を押す */
export async function acceptConfirm(): Promise<void> {
  await waitFor(() => {
    if (!document.querySelector(SHEET)) throw new Error("確認シートが出ていません");
  });
  const buttons = document.querySelectorAll<HTMLButtonElement>(`${SHEET} button`);
  /*
   * 【初心者向け】押したあと、待っていた側（`await confirm(...)` の続き）が動いて state が変わる。
   * その分の描き直しまで含めて終わらせてから戻るよう、`act` で包む。
   * 包まないと、呼んだ側は「押した直後＝まだ何も変わっていない」画面を見ることになる。
   */
  await act(async () => {
    fireEvent.click(buttons[buttons.length - 1]);
  });
}

/** 確認シートの「やめる」を押す */
export async function rejectConfirm(): Promise<void> {
  await waitFor(() => {
    if (!document.querySelector(SHEET)) throw new Error("確認シートが出ていません");
  });
  fireEvent.click(document.querySelector<HTMLButtonElement>(`${SHEET} button`) as HTMLButtonElement);
}

/** 確認シートに出ている文字（見出し＋説明＋ボタン） */
export function confirmSheetText(): string {
  return document.querySelector(SHEET)?.closest('[role="dialog"]')?.textContent ?? "";
}
