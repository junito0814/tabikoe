import { z } from "zod";

/**
 * 投稿の作成・更新 API が受け取る JSON の「キーの一覧」
 * 出典: #993「投稿の入力検証を 1 つのスキーマにまとめる」／方針は要件定義書 7.2「入力の検証」
 *
 * 【初心者向け】ここは**値の中身ではなく、キーの名前だけ**を見ます。
 * 画面に無い項目を足して送る形の攻撃（例: 権限や金額の欄を勝手に足す）を断るためです。
 *
 * zod の既定の動きは「知らないキーを**黙って捨てる**」で、捨てられた値は保存されないので
 * 守りとしては足りています。ただし**そういう送信が来たことに気づけません**。
 * `strictObject`（知らないキーがあったら断る）にすると、おかしな送信を受けたことが分かります。
 *
 * 値の検証はここでは行いません。項目ごとの規則は post-input-schema.ts、
 * 写真・動画は media-input.ts、旅のタイトルは lib/trips/resolve-trip.ts が見ます。
 */
export const postRequestBodySchema = z.strictObject({
  // 投稿そのものの項目（post-input-schema.ts が中身を見る）
  status: z.unknown().optional(),
  category: z.unknown().optional(),
  duration: z.unknown().optional(),
  visibility: z.unknown().optional(),
  rating: z.unknown().optional(),
  cost: z.unknown().optional(),
  visitDate: z.unknown().optional(),
  comment: z.unknown().optional(),
  lat: z.unknown().optional(),
  lng: z.unknown().optional(),
  // 投稿と一緒に送られるが、投稿の列ではないもの
  /** 旅（アルバム）の名前。空なら「日常」に入る */
  tripTitle: z.unknown().optional(),
  /** 既存スポットに紐づけるときの id。`null` は「スポットの紐づけを外す」 */
  spotId: z.unknown().optional(),
  /** 新しいスポットを作るときの名前 */
  spotName: z.unknown().optional(),
  /** #929「行ってわかったこと」。投稿ではなくスポットに付く */
  visitFindings: z.unknown().optional(),
  /** 先にアップロードした写真・動画の保存先（media-input.ts） */
  media: z.unknown().optional(),
  /** v1 のときの写真の保存先の配列。いまの画面は送らないが、受け付けは残す */
  photoPaths: z.unknown().optional(),
});

/**
 * 知らないキーが混ざっていないかだけを確かめる。
 *
 * @returns 混ざっていたキーの名前（無ければ `null`）
 */
export function unknownPostFields(body: unknown): string[] | null {
  const result = postRequestBodySchema.safeParse(body);
  if (result.success) return null;
  const keys = result.error.issues.flatMap((issue) => (issue.code === "unrecognized_keys" ? issue.keys : []));
  return keys.length > 0 ? keys : null;
}
