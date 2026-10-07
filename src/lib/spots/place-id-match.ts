/**
 * #755: 「この Place ID を、このスポットに結び付けてよいか」の判断だけを集めたところ
 * 出典: docs/tasks/data/backfill-place-id.md（#755）
 *
 * 【初心者向け】なぜ画面でもスクリプトでもなく、ここに書くのか。
 *   ここを間違えると「大阪城」のスポットに**別の店の Place ID** が入り、
 *   公式情報（営業時間・電話番号）に**他人の店の情報**が出ます。取り違えは目で気づきにくく、
 *   しかも一度入れてしまうと「どれが間違いか」が分からなくなります。
 *   だから判断だけを純粋関数にして、テストで固めてあります（約束 13）。
 *
 * 判断の方針は「迷ったら結び付けない」。
 *   結び付けなければ公式情報が出ないだけで済みますが、取り違えると**嘘を表示します**。
 */

/** ここより遠い候補は「別の場所」と見なす（m） */
export const MAX_DISTANCE_M = 500;

export interface LatLng {
  lat: number;
  lng: number;
}

export type PlaceIdMatch = { ok: true; distanceM: number } | { ok: false; reason: string };

/**
 * 2 点の距離（m）。
 *
 * 【初心者向け】地球は丸いので、緯度経度の差をそのまま引き算すると距離になりません
 * （同じ「経度 1 度」でも、赤道と北海道では長さが違う）。球面での距離を出す決まった式
 * （ハバーサイン）を使っています。式の中身は覚えなくてよく、「2 点の距離が m で出る」だけ分かれば十分です。
 */
export function metersBetween(a: LatLng, b: LatLng): number {
  const earthRadiusM = 6371000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * 名前から「（seed）」の印を外す。
 *
 * 【初心者向け】これを忘れると**間違った場所に結び付きます**。実際、最初に走らせたとき
 * 「横浜 赤レンガ倉庫（seed）」のまま Google に投げてしまい、1.4km 離れた別の場所が返りました。
 * 「（seed）」は**こちらが付けた印**（お試しデータの目印。#776 で消す）で、Google 側には無い言葉です。
 * 検索語と名前の見比べ、両方から外します。
 */
export function withoutSeedMarker(name: string): string {
  return name.replace(/[（(]\s*seed\s*[)）]|\[\s*seed\s*\]/gi, "").trim();
}

/**
 * 見比べ用に名前を揃える。
 * Google は「横浜赤レンガ倉庫」、こちらは「横浜 赤レンガ倉庫」のように**空白や中黒だけが違う**ことが多いので、
 * 記号と空白を落として比べる。
 */
export function normalizeName(name: string): string {
  return withoutSeedMarker(name)
    .replace(/[\s・･()（）[\]「」]/g, "")
    .toLowerCase();
}

/**
 * 名前と座標の両方で確かめて、結び付けてよいかを返す。
 *
 * 名前は**記号と空白を無視して、ぴったり同じ**であることを求める。
 *
 * 【初心者向け】最初は「どちらかがもう一方を含んでいればよい」にしていたが、**これは危ない**。
 * 「大阪城」に対して、すぐ隣（0m）の「大阪城公園駅前のコンビニ」が通ってしまう
 * （「大阪城」を含むため）。座標が近いことは**同じ場所である証拠にならない**ので、
 * 名前はぴったり一致を求める。
 *
 * 代わりに「大阪城天守閣」のような**少し長い正式名**は落ちるが、落ちた場合は `place_id` が
 * 空のまま＝公式情報が出ないだけで、嘘は表示されない。
 */
export function matchesSpot(
  spot: { name: string } & LatLng,
  candidate: { name: string } & LatLng,
): PlaceIdMatch {
  if (!Number.isFinite(candidate.lat) || !Number.isFinite(candidate.lng)) {
    return { ok: false, reason: "座標が取れない" };
  }
  const distanceM = Math.round(metersBetween(spot, candidate));
  if (distanceM > MAX_DISTANCE_M) {
    return { ok: false, reason: `${distanceM}m 離れている（別の場所の可能性）` };
  }
  const ours = normalizeName(spot.name);
  const theirs = normalizeName(candidate.name);
  if (ours.length === 0 || theirs.length === 0) {
    return { ok: false, reason: "名前が空" };
  }
  if (ours !== theirs) {
    return { ok: false, reason: `名前が違う（${candidate.name}）` };
  }
  return { ok: true, distanceM };
}
