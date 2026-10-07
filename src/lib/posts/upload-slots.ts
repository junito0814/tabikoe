/**
 * #860: 直接アップロードの「置き場所」の決め方
 * 出典: Issue #860「Bug 5: 4.5MB を超える写真が投稿できない（Vercel が本文を関数に渡さない）」
 *
 * 【初心者向け】署名付き URL を配るということは、**ブラウザが Storage に直接書ける**ということです。
 * だからこそ、どこに書けるかは**サーバーが決めます**（利用者に決めさせない）。
 *   - 必ず**自分の ID の下**。他人のファイルを上書きできない
 *   - 使い捨ての名前。同じ投稿で 2 枚選んでもぶつからない
 *   - `tmp/` の下に置き、検査が終わったら消す（検査に落ちたものも消す）
 *
 * 判断だけをここに置いているので、テストで固められます（約束 13）。
 */

/** 1 回に配る枚数の上限（要件 3.3.1 は枚数無制限だが、1 回の往復はこのくらいに区切る） */
export const MAX_UPLOAD_SLOTS = 20;

/** 検査前の置き場所。ここに置いたものは、検査が終わったら必ず消す */
export function tempUploadPath(userId: string, uuid: string = crypto.randomUUID()): string {
  return `${userId}/tmp/${uuid}`;
}

/** そのパスが、その人が書いてよい場所か（受け取ったパスを信じないための確かめ） */
export function isOwnTempPath(path: string, userId: string): boolean {
  if (path.includes("..") || path.startsWith("/")) return false;
  const parts = path.split("/");
  return parts.length === 3 && parts[0] === userId && parts[1] === "tmp" && parts[2].length > 0;
}
