/**
 * search-top Task1: 47 都道府県の固定リスト（名前・読み・中心座標）
 * 出典: docs/tasks/map-search/search-top/01-suggest-api.md
 *
 * 【初心者向け】都道府県は増減しないので API を呼ばず、アプリ内の配列で候補を出す。
 * 読み（ひらがな）は「おおさ」のような入力の前方一致に使う。中心座標は県庁所在地付近。
 */
export interface Prefecture {
  name: string;
  kana: string;
  lat: number;
  lng: number;
}

export const PREFECTURES: readonly Prefecture[] = [
  { name: "北海道", kana: "ほっかいどう", lat: 43.0642, lng: 141.3469 },
  { name: "青森県", kana: "あおもりけん", lat: 40.8244, lng: 140.74 },
  { name: "岩手県", kana: "いわてけん", lat: 39.7036, lng: 141.1527 },
  { name: "宮城県", kana: "みやぎけん", lat: 38.2688, lng: 140.8721 },
  { name: "秋田県", kana: "あきたけん", lat: 39.7186, lng: 140.1024 },
  { name: "山形県", kana: "やまがたけん", lat: 38.2404, lng: 140.3633 },
  { name: "福島県", kana: "ふくしまけん", lat: 37.7503, lng: 140.4676 },
  { name: "茨城県", kana: "いばらきけん", lat: 36.3418, lng: 140.4468 },
  { name: "栃木県", kana: "とちぎけん", lat: 36.5657, lng: 139.8836 },
  { name: "群馬県", kana: "ぐんまけん", lat: 36.3911, lng: 139.0608 },
  { name: "埼玉県", kana: "さいたまけん", lat: 35.8569, lng: 139.6489 },
  { name: "千葉県", kana: "ちばけん", lat: 35.6047, lng: 140.1233 },
  { name: "東京都", kana: "とうきょうと", lat: 35.6895, lng: 139.6917 },
  { name: "神奈川県", kana: "かながわけん", lat: 35.4478, lng: 139.6425 },
  { name: "新潟県", kana: "にいがたけん", lat: 37.9026, lng: 139.0236 },
  { name: "富山県", kana: "とやまけん", lat: 36.6953, lng: 137.2113 },
  { name: "石川県", kana: "いしかわけん", lat: 36.5947, lng: 136.6256 },
  { name: "福井県", kana: "ふくいけん", lat: 36.0652, lng: 136.2216 },
  { name: "山梨県", kana: "やまなしけん", lat: 35.6642, lng: 138.5684 },
  { name: "長野県", kana: "ながのけん", lat: 36.6513, lng: 138.181 },
  { name: "岐阜県", kana: "ぎふけん", lat: 35.3912, lng: 136.7223 },
  { name: "静岡県", kana: "しずおかけん", lat: 34.9769, lng: 138.3831 },
  { name: "愛知県", kana: "あいちけん", lat: 35.1802, lng: 136.9066 },
  { name: "三重県", kana: "みえけん", lat: 34.7303, lng: 136.5086 },
  { name: "滋賀県", kana: "しがけん", lat: 35.0045, lng: 135.8686 },
  { name: "京都府", kana: "きょうとふ", lat: 35.0212, lng: 135.7556 },
  { name: "大阪府", kana: "おおさかふ", lat: 34.6863, lng: 135.52 },
  { name: "兵庫県", kana: "ひょうごけん", lat: 34.6913, lng: 135.183 },
  { name: "奈良県", kana: "ならけん", lat: 34.6851, lng: 135.8329 },
  { name: "和歌山県", kana: "わかやまけん", lat: 34.226, lng: 135.1675 },
  { name: "鳥取県", kana: "とっとりけん", lat: 35.5039, lng: 134.2377 },
  { name: "島根県", kana: "しまねけん", lat: 35.4723, lng: 133.0505 },
  { name: "岡山県", kana: "おかやまけん", lat: 34.6618, lng: 133.9344 },
  { name: "広島県", kana: "ひろしまけん", lat: 34.3966, lng: 132.4596 },
  { name: "山口県", kana: "やまぐちけん", lat: 34.1859, lng: 131.4714 },
  { name: "徳島県", kana: "とくしまけん", lat: 34.0658, lng: 134.5593 },
  { name: "香川県", kana: "かがわけん", lat: 34.3401, lng: 134.0434 },
  { name: "愛媛県", kana: "えひめけん", lat: 33.8416, lng: 132.7657 },
  { name: "高知県", kana: "こうちけん", lat: 33.5597, lng: 133.5311 },
  { name: "福岡県", kana: "ふくおかけん", lat: 33.6064, lng: 130.4181 },
  { name: "佐賀県", kana: "さがけん", lat: 33.2494, lng: 130.2988 },
  { name: "長崎県", kana: "ながさきけん", lat: 32.7448, lng: 129.8737 },
  { name: "熊本県", kana: "くまもとけん", lat: 32.7898, lng: 130.7417 },
  { name: "大分県", kana: "おおいたけん", lat: 33.2382, lng: 131.6126 },
  { name: "宮崎県", kana: "みやざきけん", lat: 31.9111, lng: 131.4239 },
  { name: "鹿児島県", kana: "かごしまけん", lat: 31.5602, lng: 130.5581 },
  { name: "沖縄県", kana: "おきなわけん", lat: 26.2124, lng: 127.6809 },
] as const;

/** 前方一致（漢字・読みのどちらでも）。「県・府・都・道」を省いた入力にも合う */
export function matchPrefectures(query: string, limit = 3): Prefecture[] {
  const q = query.trim();
  if (!q) return [];
  const hira = toHiragana(q);
  return PREFECTURES.filter((p) => p.name.startsWith(q) || p.kana.startsWith(hira)).slice(0, limit);
}

/** カタカナをひらがなに（読みの照合用） */
export function toHiragana(value: string): string {
  return value.replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

/** 都道府県名（完全一致）から中心座標を引く */
export function findPrefecture(name: string): Prefecture | null {
  return PREFECTURES.find((p) => p.name === name) ?? null;
}
