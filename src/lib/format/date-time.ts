/**
 * #771（2026-10-06）: 「いつ」の書き方を 1 か所にまとめる
 * 出典: Issue #771「日時の書き方を 1 か所にまとめる（秒を出さない・1 日経ったら日付だけ）」
 *
 * 【初心者向け】投稿・コメント・通知の日時が `2026/10/5 13:41:16` と**秒まで**出ていました。
 * `toLocaleString("ja-JP")` の既定が秒つきだからです。秒まで要る場面はありません。
 *
 * 決めた形（2026-10-06）:
 *
 *   - **24 時間以内** … 時刻つき（分まで）  `10/5 13:41`
 *   - **24 時間経ったら** … 日付だけ        `2026/10/5`
 *
 * 「さっき書いたものか」は時刻を見たい一方、何日も前のものは日付で足ります。
 *
 * **時差について**: 常に日本時間（Asia/Tokyo）で書きます。`toLocaleString` は
 * **動かしている端末の時間帯**に従うので、サーバーで描いた文字と端末で描いた文字が
 * ずれることがありました（`todayInJst` と同じ考え方）。
 *
 * 絶対日付が要る場所（しおりの期間・訪問日・招待の期限）はここを通しません。
 * あちらは「いつ」ではなく「その日そのもの」だからです。
 */
const TOKYO = "Asia/Tokyo";

/** 24 時間（ミリ秒） */
export const WITHIN_HOURS_MS = 24 * 60 * 60 * 1000;

const DATE_ONLY = new Intl.DateTimeFormat("ja-JP", { timeZone: TOKYO, year: "numeric", month: "numeric", day: "numeric" });
const WITH_TIME = new Intl.DateTimeFormat("ja-JP", { timeZone: TOKYO, month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

/**
 * 投稿・コメント・通知の「いつ」。
 *
 * @param iso ISO 8601 の日時。読めなければ空文字を返す（画面に `Invalid Date` を出さない）
 * @param now 今。テストから固定するために渡せる
 */
export function formatDateTime(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return "";
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  // ちょうど 24 時間は「経った」側（24 時間**以内**が時刻つき）
  const isRecent = now.getTime() - at.getTime() < WITHIN_HOURS_MS;
  // `10/5 13:41` にしたいが、ja-JP の既定は `10/5 13:41` の間に全角空白などが入ることがあるので整える
  return isRecent ? WITH_TIME.format(at).replace(/\s+/g, " ").trim() : DATE_ONLY.format(at);
}

/** 絶対日付（訪問日・期限など）。`2026/10/5` */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  return DATE_ONLY.format(at);
}
