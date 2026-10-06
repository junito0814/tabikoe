/**
 * #758（2026-10-06）: 「＋」を「✓」にするのはどんなときか
 * 出典: Issue #758「Bug 5: 行きたい・しおりから外しても「＋」に戻らず「✓」のまま」
 *
 * 【初心者向け】保存すると「＋」が「✓」に変わりますが、**外しても戻りません**でした。
 * 画面を開き直すと「＋」に戻る（サーバーから取り直すため）ので、**画面の中の状態だけがずれて**いました。
 *
 * 原因は `setSaved(result.wishlisted || result.savedItinerary !== null || saved)` の
 * 末尾の **`|| saved`** です。これがあると**一度 true になると二度と false に戻りません**。
 *
 * ただし `|| saved` を消すだけでは逆の間違いが起きます。`savedItinerary` は
 * 「**今このシートで追加した**しおり」なので、外したときは `null` のままで、
 * 「どのしおりにも入っていない」のか「元から入っている別のしおりがある」のかが区別できません。
 * そこでシートに「**今の本当の状態**」（どれかのしおりに入っているか）を返させ、ここで判断します。
 */
export function isSpotSaved(wishlisted: boolean, inAnyItinerary: boolean): boolean {
  return wishlisted || inAnyItinerary;
}
