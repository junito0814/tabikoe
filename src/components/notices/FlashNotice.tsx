/**
 * 操作完了後の遷移先に出す一行の完了メッセージ（投稿・更新・削除・ブロック）。
 * 各操作はクエリ（posted=1 など）で遷移先へ結果を渡す。表示は SC-02（全体マップ）が担う。
 */
export const FLASH_MESSAGES = {
  posted: "投稿しました",
  updated: "投稿を更新しました",
  deleted: "投稿を削除しました",
  blocked: "ユーザーをブロックしました",
} as const;

export type FlashKey = keyof typeof FLASH_MESSAGES;

/** クエリから最初に該当したフラッシュを1つ選ぶ */
export function resolveFlashKey(params: Partial<Record<FlashKey, string | undefined>>): FlashKey | null {
  for (const key of Object.keys(FLASH_MESSAGES) as FlashKey[]) {
    if (params[key] === "1") return key;
  }
  return null;
}

export function FlashNotice({ flashKey }: { flashKey: FlashKey }) {
  return (
    <p
      role="status"
      className="rounded-lg border border-done/25 bg-done/[0.08] px-3.5 py-2.5 text-center text-[0.8125rem] text-done"
    >
      {FLASH_MESSAGES[flashKey]}
    </p>
  );
}
