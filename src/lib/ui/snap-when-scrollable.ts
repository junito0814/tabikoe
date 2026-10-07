/**
 * #867（2026-10-07）: 吸い付き（scroll-snap）を付けてよいかの判断
 * 出典: Issue #867「Bug 2: 投稿が 1 件のスポットで、下まで送れずコメントが開けない」
 *
 * 【初心者向け】上 1/3 地図の画面は、**ページ全体の吸い付き**で「地図かシートのどちらかに落ち着く」
 * ようにしています（`scroll-snap-type: y proximity`。吸い付く場所はページの先頭とシートの上端）。
 *
 * ところが、投稿が 1 件しかないときのように**中身が短い**と、送れる量が
 * 2 つめの吸い付き位置をわずかに超えるだけになります。`proximity` は近くの吸い付き位置へ
 * 引き戻すので、**最後のわずかな部分に指を離した状態で留まれません**。
 * そこにコメントの行があり、押せませんでした。
 *
 * そこで「ちゃんと送れる画面」でだけ吸い付かせます。**ほとんど送れない画面では、
 * そもそも吸い付かせる意味がありません**（落ち着き先が 1 つしかないため）。
 *
 * 判断だけをここに置いているので、画面の作りが変わってもここだけテストすれば済みます（約束 13）。
 */

/**
 * 2 つめの吸い付き位置（シートの上端）より、これだけ余分に送れないと吸い付かせない（px）。
 * 吸い付きの引き戻しから抜け出せる程度の余白として、画面の高さの 1/4 を目安にしている。
 */
export const SNAP_HEADROOM_RATIO = 0.25;

export function shouldSnap({
  scrollHeight,
  viewportHeight,
  snapOffset,
}: {
  /** ページ全体の高さ */
  scrollHeight: number;
  /** 画面の高さ */
  viewportHeight: number;
  /** 2 つめの吸い付き位置（＝地図の高さ。シートの上端） */
  snapOffset: number;
}): boolean {
  if (viewportHeight <= 0 || snapOffset <= 0) return false;
  const scrollable = scrollHeight - viewportHeight;
  // 2 つめの吸い付き位置にすら届かないなら、吸い付く先が 1 つしかない
  if (scrollable <= snapOffset) return false;
  return scrollable - snapOffset >= viewportHeight * SNAP_HEADROOM_RATIO;
}
