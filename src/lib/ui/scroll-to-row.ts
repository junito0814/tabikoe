/**
 * #761（2026-10-06）: 地図のピンから一覧の行へ飛ぶときの「どう動かすか」
 * 出典: Issue #761「しおりの地図のピンをタップしたら、一覧のその行へ飛んで光らせる」
 *
 * 【初心者向け】判断（ルール）はここに切り出しておきます（約束 13）。画面の作りが変わっても、
 * 「どう動かすか」はここだけをテストすれば済みます。
 */

/** 光らせておく長さ（ミリ秒）。押したことが分かるだけの短さ */
export const HIGHLIGHT_MS = 1500;

/**
 * スクロールのしかた。
 *
 * OS で「視差効果を減らす」を入れている人には**滑らかに動かさない**（`prefers-reduced-motion`）。
 * 滑らかな動きは、乗り物酔いに似た不快感の原因になることがあるためです。
 * 調べられない環境（jsdom・古いブラウザ）では、安全側に倒して滑らかにしません。
 */
export function scrollBehaviorFor(matchMedia: ((query: string) => { matches: boolean }) | undefined): ScrollBehavior {
  if (typeof matchMedia !== "function") return "auto";
  return matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

/**
 * 行まで寄せる。`scrollIntoView` が無い環境（jsdom）では何もしない。
 *
 * 【初心者向け】`block: "nearest"` は「**見えていれば動かさない。見えていなければ、
 * ちょうど見える所まで最小限だけ動かす**」という意味です。`"center"` にすると、
 * すでに見えている行でも真ん中へ持ってくるために一覧を上へ送ってしまい、
 * しおり詳細では**上 1/3 の地図が一覧に隠れて**しまいました（押した地図が見えなくなる）。
 */
export function scrollRowIntoView(row: Element | null, behavior: ScrollBehavior): void {
  if (!row || typeof (row as HTMLElement).scrollIntoView !== "function") return;
  (row as HTMLElement).scrollIntoView({ block: "nearest", behavior });
}
