// seed（ダミーデータ）の「何を入れるか」の定義。入れる側（seed-tokyo.mjs）と
// 消す側（clean-seed.mjs）・直す側（strip-seed-markers.mjs）が**同じものを見る**ための場所。
//
// 【初心者向け】なぜ分けたか（#776）。
//   もともと seed の行は**名前の印**（スポット名の末尾「（seed）」、ユーザー名の先頭「[seed] 」）で
//   見分けていた。その印を画面から消すと、消す側が seed を見つけられなくなる。
//   そこで「何を入れたか」の定義をここ 1 か所に置き、入れる側と消す側の両方がここを読む（約束 14）。
//
// ※ 名前だけで消すのは危険。利用者が自分で「東京タワー」を作っていることがあり、
//   名前で消すと**本物まで消える**。実際にこの DB には seed ではない「東京タワー」がある。
//   だから消す側は、seed-tokyo.mjs が書き出す seed-ids.json（入れた行の id）を使う。

/** seed のダミーユーザーの email のドメイン。実在しない TLD なのでメールは届かない */
export const SEED_EMAIL_DOMAIN = "example.invalid";

/**
 * 旧版が名前に付けていた印。**もう付けないが、既にある行を見つけるために残す**（#776）。
 * strip-seed-markers.mjs がこれを頼りに古い行を探し、clean-seed.mjs も保険として見る。
 */
export const LEGACY_SEED_TAG = "[seed] ";
export const LEGACY_SEED_SPOT_SUFFIX = "（seed）";

// ---- ダミーユーザー ----
export const DUMMY_USERS = [
  { key: "taro", name: "たろう" },
  { key: "misaki", name: "みさき" },
  { key: "kenta", name: "けんた" },
  { key: "ai", name: "あい" },
];

/** 旅行（アルバム）の題名。ダミーユーザーごと */
export const TRIP_TITLES = {
  taro: ["東京 食べ歩き", "下町さんぽ"],
  misaki: ["東京 カフェ巡り"],
  kenta: ["週末の東京", "高尾山"],
  ai: ["ひとり東京"],
};

/** 「自分」のしおりが入る旅行の題名 */
export const MY_TRIP_TITLE = "東京 2 泊 3 日";

// ---- スポット（東京中心。source=manual は「タビコエだけの場所」） ----
// lat/lng は実在の場所に寄せている（地図で見たときに位置関係が分かるように）
export const SPOTS = [
  { name: "浅草寺", lat: 35.7148, lng: 139.7967, source: "places", cat: "観光スポット" },
  { name: "隅田公園の桜並木", lat: 35.7136, lng: 139.8016, source: "places", cat: "自然・景勝地" },
  { name: "かっぱ橋の小さな金物屋", lat: 35.7135, lng: 139.7885, source: "manual", cat: "ショッピング" },
  { name: "東京スカイツリー", lat: 35.7101, lng: 139.8107, source: "places", cat: "観光スポット" },
  { name: "押上の路地裏 喫茶", lat: 35.7108, lng: 139.8135, source: "manual", cat: "グルメ" },
  { name: "谷中銀座", lat: 35.7276, lng: 139.7651, source: "places", cat: "ショッピング" },
  { name: "谷中の猫がいる坂", lat: 35.7262, lng: 139.7668, source: "manual", cat: "自然・景勝地" },
  { name: "上野恩賜公園", lat: 35.7146, lng: 139.7734, source: "places", cat: "自然・景勝地" },
  { name: "アメ横の立ち飲み", lat: 35.7104, lng: 139.7742, source: "manual", cat: "グルメ" },
  { name: "秋葉原 ラジオ会館", lat: 35.6987, lng: 139.7714, source: "places", cat: "ショッピング" },
  { name: "神保町の古本カフェ", lat: 35.6957, lng: 139.7577, source: "manual", cat: "グルメ" },
  { name: "皇居 東御苑", lat: 35.6858, lng: 139.7574, source: "places", cat: "自然・景勝地" },
  { name: "東京駅 丸の内駅舎", lat: 35.6812, lng: 139.7671, source: "places", cat: "観光スポット" },
  { name: "日本橋の屋上テラス", lat: 35.6838, lng: 139.7745, source: "manual", cat: "自然・景勝地" },
  { name: "築地場外市場", lat: 35.6654, lng: 139.7707, source: "places", cat: "グルメ" },
  { name: "築地の卵焼き屋（行列なし）", lat: 35.6659, lng: 139.7702, source: "manual", cat: "グルメ" },
  { name: "浜離宮恩賜庭園", lat: 35.6598, lng: 139.7634, source: "places", cat: "自然・景勝地" },
  { name: "チームラボプラネッツ", lat: 35.6493, lng: 139.7899, source: "places", cat: "エンタメ・イベント" },
  { name: "豊洲ぐるり公園の夕日", lat: 35.6466, lng: 139.7856, source: "manual", cat: "自然・景勝地" },
  { name: "お台場海浜公園", lat: 35.6295, lng: 139.7752, source: "places", cat: "自然・景勝地" },
  { name: "月島もんじゃストリート", lat: 35.6640, lng: 139.7830, source: "places", cat: "グルメ" },
  { name: "清澄白河のロースター", lat: 35.6809, lng: 139.7987, source: "manual", cat: "グルメ" },
  { name: "清澄庭園", lat: 35.6797, lng: 139.7972, source: "places", cat: "自然・景勝地" },
  { name: "渋谷スクランブル交差点", lat: 35.6595, lng: 139.7004, source: "places", cat: "観光スポット" },
  { name: "渋谷 奥の立ち食い蕎麦", lat: 35.6572, lng: 139.6973, source: "manual", cat: "グルメ" },
  { name: "明治神宮", lat: 35.6764, lng: 139.6993, source: "places", cat: "観光スポット" },
  { name: "代々木公園の日曜マーケット", lat: 35.6717, lng: 139.6949, source: "manual", cat: "エンタメ・イベント" },
  { name: "下北沢の古着屋通り", lat: 35.6613, lng: 139.6681, source: "places", cat: "ショッピング" },
  { name: "下北沢 カレーの路地", lat: 35.6620, lng: 139.6670, source: "manual", cat: "グルメ" },
  { name: "吉祥寺 井の頭公園", lat: 35.7000, lng: 139.5745, source: "places", cat: "自然・景勝地" },
  { name: "吉祥寺ハモニカ横丁", lat: 35.7038, lng: 139.5795, source: "places", cat: "グルメ" },
  { name: "三鷹の森ジブリ美術館", lat: 35.6962, lng: 139.5704, source: "places", cat: "エンタメ・イベント" },
  { name: "新宿御苑", lat: 35.6852, lng: 139.7100, source: "places", cat: "自然・景勝地" },
  { name: "新宿 思い出横丁", lat: 35.6934, lng: 139.6996, source: "places", cat: "グルメ" },
  { name: "都庁展望室", lat: 35.6896, lng: 139.6917, source: "places", cat: "観光スポット" },
  { name: "神楽坂の石畳の路地", lat: 35.7020, lng: 139.7400, source: "manual", cat: "観光スポット" },
  { name: "赤城神社カフェ", lat: 35.7040, lng: 139.7360, source: "manual", cat: "グルメ" },
  { name: "六本木ヒルズ展望台", lat: 35.6605, lng: 139.7292, source: "places", cat: "観光スポット" },
  { name: "麻布十番の温泉銭湯", lat: 35.6555, lng: 139.7360, source: "manual", cat: "体験・アクティビティ" },
  { name: "東京タワー", lat: 35.6586, lng: 139.7454, source: "places", cat: "観光スポット" },
  { name: "芝公園から見る東京タワー", lat: 35.6549, lng: 139.7488, source: "manual", cat: "自然・景勝地" },
  { name: "品川 水族館", lat: 35.5885, lng: 139.7390, source: "places", cat: "エンタメ・イベント" },
  { name: "蔵前のノート屋", lat: 35.7025, lng: 139.7906, source: "manual", cat: "ショッピング" },
  { name: "蔵前 川沿いのホステル", lat: 35.7030, lng: 139.7930, source: "manual", cat: "宿泊施設" },
  { name: "浅草のゲストハウス", lat: 35.7170, lng: 139.7940, source: "manual", cat: "宿泊施設" },
  { name: "羽田空港 展望デッキ", lat: 35.5494, lng: 139.7798, source: "places", cat: "観光スポット" },
  { name: "高尾山 山頂", lat: 35.6252, lng: 139.2436, source: "places", cat: "自然・景勝地" },
  { name: "高尾山口の団子屋", lat: 35.6322, lng: 139.2700, source: "manual", cat: "グルメ" },
  { name: "奥多摩 川遊びスポット", lat: 35.8090, lng: 139.0960, source: "manual", cat: "体験・アクティビティ" },
  { name: "横浜 赤レンガ倉庫", lat: 35.4529, lng: 139.6428, source: "places", cat: "観光スポット", pref: "神奈川県" },
  { name: "鎌倉 海が見える坂", lat: 35.3040, lng: 139.5350, source: "manual", cat: "自然・景勝地", pref: "神奈川県" },
];
