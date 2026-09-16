/**
 * `spots` に登録済みのスポット。投稿にはこの id を紐づける。
 * source は由来: "places"＝Google Places から登録、"manual"＝利用者が地図上で手動登録（＝「タビコエだけの場所」）
 * prefecture はスポット登録時にサーバーで逆ジオコーディングして入れる（バッジ判定と都道府県検索に使う）
 */
export interface RegisteredSpot {
  id: string;
  name: string;
  lat: number;
  lng: number;
  prefecture: string | null;
  source: "places" | "manual";
}
