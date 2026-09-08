/**
 * 書記素クラスタ単位で文字数をカウントする（絵文字・結合文字も1文字として数える）。
 * サーバー側バリデーションとクライアント側の残り文字数表示の両方で共用する。
 */
export function graphemeLength(text: string): number {
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  return Array.from(segmenter.segment(text)).length;
}
