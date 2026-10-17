/**
 * #953（2026-10-17）: 共有する文面
 * 出典: Issue #953、要件定義書 4.5.18、ワイヤーフレーム決定事項 96
 *
 * 【初心者向け】**URL だけにしません。** リンクカード（OG。#952）が出る場所ばかりではないからです
 * （メールや、カードを出さないアプリに送られることがあります）。そこでも中身が伝わるように、
 * 題名と 1 行の説明を添えます。
 *
 * 判断（どんな文字列になるか）をここに切り出してあるので、画面を変えてもここだけ見れば済みます（約束 13）。
 */
export interface ShareContent {
  /** 端末の共有シートに渡す題名 */
  title: string;
  /** 題名の下の 1 行 */
  text: string;
  /** 共有する URL（絶対 URL。画面側で `location.origin` を足す） */
  url: string;
}

/** 題名は OG カードと同じ `〈スポット名〉｜タビコエ`（2 通りの言い方を作らない。約束 14） */
function shareTitle(spotName: string): string {
  return `${spotName}｜タビコエ`;
}

/** スポット（SC-04）: `行った人の投稿 N 件　★x.x` */
export function spotShareContent(options: { spotName: string; postCount: number; ratingAverage: number | null; url: string }): ShareContent {
  const count = `行った人の投稿 ${options.postCount} 件`;
  return {
    title: shareTitle(options.spotName),
    text: options.ratingAverage === null ? count : `${count}　★${options.ratingAverage.toFixed(1)}`,
    url: options.url,
  };
}

/** 投稿（SC-05）: 感想の冒頭 1 行 */
export function postShareContent(options: { spotName: string; comment: string | null; url: string }): ShareContent {
  const line = (options.comment ?? "").split(/\r?\n/)[0]?.trim() ?? "";
  return {
    title: shareTitle(options.spotName),
    text: line.length === 0 ? "行った人の投稿" : line.length > 90 ? `${line.slice(0, 90)}…` : line,
    url: options.url,
  };
}

/**
 * `navigator.share` が無い環境でコピーする 1 つの文字列。
 *
 * 【初心者向け】共有シートは「題名・説明・URL」を別々に受け取りますが、コピーは 1 つの文字列です。
 * 貼り付けた先で読めるよう、改行でつなぎます。
 */
export function shareClipboardText(content: ShareContent): string {
  return `${content.title}\n${content.text}\n${content.url}`;
}
