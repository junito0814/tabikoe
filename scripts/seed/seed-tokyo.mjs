// ダミーデータ（東京中心・約 50 投稿）を Supabase に入れる。消すときは `node scripts/seed/clean-seed.mjs`。
//
// 使い方:  node scripts/seed/seed-tokyo.mjs [--me you@example.com]
//   - .env.local の NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SECRET_KEY（service_role）を使う
//   - --me を省略すると junitodaze0814@gmail.com を「自分」として扱う（users テーブルに居ること）
//
// 【初心者向け】このスクリプトが作る行には全部「seed の目印」を付けている。
//   - ダミーユーザー: email が `seed-*@example.invalid`、display_name の先頭に「[seed] 」
//   - スポット: name の末尾に「（seed）」
//   - 旅行（アルバム）: title の先頭に「[seed] 」
//   - 投稿・写真・コメント・いいね・行きたい・しおり・通知: 上のユーザー／スポット／旅行に紐づくので、それを消せば一緒に消える（外部キーの cascade）
//   あなた自身の行（自分の投稿・下書き・行きたい・しおりの参加）は「seed のスポット／旅行」に紐づくものだけ作るので、
//   clean-seed.mjs がスポットと旅行を消せば、あなたの seed 由来の行だけが消えて、それ以外のあなたのデータは残る。
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

// ---- .env.local を読む（dotenv を入れていないので自前で） ----
const env = Object.fromEntries(
  readFileSync(new URL("../../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^"|"$/g, "")];
    })
);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error(".env.local に NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY が要ります");
const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const meEmail = process.argv.includes("--me") ? process.argv[process.argv.indexOf("--me") + 1] : "junitodaze0814@gmail.com";

// ---- 目印 ----
export const SEED_TAG = "[seed] ";
export const SEED_SPOT_SUFFIX = "（seed）";
export const SEED_EMAIL_DOMAIN = "example.invalid";

// ---- ダミーユーザー ----
const DUMMY_USERS = [
  { key: "taro", name: "たろう" },
  { key: "misaki", name: "みさき" },
  { key: "kenta", name: "けんた" },
  { key: "ai", name: "あい" },
];

// ---- スポット（東京中心。source=manual は「タビコエだけの場所」） ----
// lat/lng は実在の場所に寄せている（地図で見たときに位置関係が分かるように）
const SPOTS = [
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

// v3.2 の 7 択（2026-09-22: 旧「それ以上」をやめた。宿泊施設は「宿泊」）
const DURATIONS = ["30分以内", "1時間以内", "2時間以内", "3時間以内", "半日", "1日"];
const COMMENTS = [
  "朝イチで行ったら人が少なくてゆっくり見られた。午後は混むと思う。",
  "写真で見るより広い。1 時間じゃ足りなかった。",
  "地元の人に教えてもらった場所。看板が無いので通り過ぎそうになる。",
  "値段のわりに満足度が高い。現金しか使えないので注意。",
  "夕方の光がきれい。三脚は使えないので手持ちで。",
  "雨の日でも楽しめる。屋根がある。",
  "駅から少し歩くけど、その分静か。",
  "子ども連れでも大丈夫だった。ベンチが多い。",
  "行列は 15 分くらい。回転は早い。",
  "無料。近くのコンビニでコーヒー買って座るのがおすすめ。",
  "夜のライトアップが良い。20 時までなので早めに。",
  "店員さんが親切でいろいろ教えてくれた。",
];
const PHOTO = (seed, w = 800, h = 800) => `https://picsum.photos/seed/${seed}/${w}/${h}`;

// 「自分」のしおり（東京 2 泊 3 日）に入れるスポット（SPOTS の index）
const MY_ITINERARY = {
  title: "東京 2 泊 3 日",
  start: "2026-10-10",
  end: "2026-10-12",
  spots: [
    { i: 0, day: 1, time: "09:30", memo: "朝イチで", checked: true },
    { i: 2, day: 1, time: "11:00", memo: "包丁を見る", checked: true },
    { i: 4, day: 1, time: "14:00", memo: "" , checked: false },
    { i: 3, day: 1, time: null, memo: "夜景", checked: false },
    { i: 14, day: 2, time: "08:00", memo: "朝ごはん", checked: false },
    { i: 16, day: 2, time: "10:30", memo: "", checked: false },
    { i: 17, day: 2, time: "13:00", memo: "予約済み", checked: false },
    { i: 23, day: 3, time: "10:00", memo: "", checked: false },
    { i: 26, day: 3, time: null, memo: "日曜なら", checked: false },
    { i: 35, day: null, time: null, memo: "時間があれば", checked: false },
    { i: 42, day: null, time: null, memo: "", checked: false },
  ],
};
const MY_WISHLIST = [6, 8, 18, 21, 38, 49]; // 行きたい（SPOTS の index）
const MY_DRAFTS = [
  { i: 10, comment: "古本の匂いが良い。コーヒーは…" },
  { i: null, lat: 35.6900, lng: 139.7000, comment: "" },
  { i: 33, comment: "" },
  { i: 40, comment: "夜に来た。まだ書きかけ" },
];

function pick(arr, i) {
  return arr[i % arr.length];
}
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
function ymd(d) {
  return d.toISOString().slice(0, 10);
}
async function must(promise, label) {
  const { data, error } = await promise;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

async function main() {
  // 0. 自分
  const me = await must(admin.from("users").select("id, display_name").eq("email", meEmail).maybeSingle(), "users(me)");
  if (!me) throw new Error(`users に ${meEmail} が居ません。一度ログインしてから実行してください`);
  console.log(`自分: ${me.display_name ?? "(名前なし)"} ${me.id}`);

  // 1. ダミーユーザー（Auth → users）。既にあれば使い回す
  const users = [];
  for (const u of DUMMY_USERS) {
    const email = `seed-${u.key}@${SEED_EMAIL_DOMAIN}`;
    const existing = await must(admin.from("users").select("id").eq("email", email).maybeSingle(), "users(find)");
    if (existing) {
      users.push({ ...u, id: existing.id });
      continue;
    }
    const created = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      password: randomUUID(),
      user_metadata: { full_name: `${SEED_TAG}${u.name}`, seed: true },
    });
    if (created.error) throw new Error(`auth.createUser(${email}): ${created.error.message}`);
    const id = created.data.user.id;
    await must(
      admin.from("users").upsert(
        {
          id,
          idp_provider: "google",
          idp_subject: `seed:${u.key}`,
          email,
          display_name: `${SEED_TAG}${u.name}`,
          avatar_url: `https://i.pravatar.cc/120?u=seed-${u.key}`,
          consented_at: new Date().toISOString(),
        },
        { onConflict: "id", ignoreDuplicates: true }
      ),
      "users(upsert)"
    );
    users.push({ ...u, id });
  }
  console.log(`ダミーユーザー: ${users.length} 人`);

  // 2. スポット
  const spotRows = SPOTS.map((s) => ({
    id: randomUUID(),
    name: `${s.name}${SEED_SPOT_SUFFIX}`,
    lat: s.lat,
    lng: s.lng,
    prefecture: s.pref ?? "東京都",
    source: s.source,
  }));
  await must(admin.from("spots").insert(spotRows), "spots");
  console.log(`スポット: ${spotRows.length} 件`);

  // 3. 旅行（アルバム）。ダミーユーザーそれぞれ 1〜2 つ＋自分のしおり用 1 つ
  const tripRows = [];
  const tripOf = {}; // userKey -> [tripId...]
  for (const u of users) {
    const titles = u.key === "taro" ? ["東京 食べ歩き", "下町さんぽ"] : u.key === "misaki" ? ["東京 カフェ巡り"] : u.key === "kenta" ? ["週末の東京", "高尾山"] : ["ひとり東京"];
    tripOf[u.key] = [];
    for (const t of titles) {
      const id = randomUUID();
      tripRows.push({ id, user_id: u.id, title: `${SEED_TAG}${t}` });
      tripOf[u.key].push(id);
    }
  }
  const myTripId = randomUUID();
  tripRows.push({ id: myTripId, user_id: me.id, title: `${SEED_TAG}${MY_ITINERARY.title}` });
  await must(admin.from("trips").insert(tripRows), "trips");
  // アルバムのメンバー。オーナー行は trips の挿入時に DB 側（トリガー）が自動で作るので、追加メンバーだけ入れる。
  // 自分の旅行には みさき（editor）・けんた（viewer）
  await must(
    admin.from("album_members").upsert(
      [
        { trip_id: myTripId, user_id: users[1].id, role: "editor" },
        { trip_id: myTripId, user_id: users[2].id, role: "viewer" },
      ],
      { onConflict: "trip_id,user_id", ignoreDuplicates: true }
    ),
    "album_members"
  );
  console.log(`旅行（アルバム）: ${tripRows.length} 件`);

  // 4. 投稿（約 55 件。うち非公開 2 件）。スポットごとに 1 件、10 件に 1 つは 2 件
  const postRows = [];
  const photoRows = [];
  let n = 0;
  for (let i = 0; i < spotRows.length; i += 1) {
    const count = i % 10 === 0 ? 2 : 1; // 51 スポットで 57 件（＋自分の 2 件・下書き 4 件）＝「50 件ほど」
    for (let k = 0; k < count; k += 1) {
      const u = users[(i + k) % users.length];
      const trip = pick(tripOf[u.key], k);
      const created = daysAgo(1 + ((i * 7 + k * 3) % 120));
      const visit = daysAgo(2 + ((i * 7 + k * 3) % 120));
      const id = randomUUID();
      const isPrivate = n === 5 || n === 23;
      const spot = SPOTS[i];
      const cost = spot.cat === "自然・景勝地" || spot.cat === "観光スポット" ? (k === 0 ? 0 : null) : 400 + ((i * 137 + k * 50) % 24) * 100;
      postRows.push({
        id,
        user_id: u.id,
        trip_id: trip,
        spot_id: spotRows[i].id,
        category: spot.cat,
        visit_date: ymd(visit),
        duration: spot.cat === "宿泊施設" ? "宿泊" : pick(DURATIONS, i + k),
        cost,
        rating: 3 + ((i + k) % 3),
        comment: pick(COMMENTS, i * 3 + k),
        visibility: isPrivate ? "private" : "public",
        status: "published",
        lat: spot.lat,
        lng: spot.lng,
        created_at: created.toISOString(),
        published_at: created.toISOString(),
      });
      const photoCount = 1 + ((i + k) % 3); // 1〜3 枚
      for (let p = 0; p < photoCount; p += 1) {
        photoRows.push({ post_id: id, media_type: "photo", storage_url: PHOTO(`tabikoe-${i}-${k}-${p}`), display_order: p });
      }
      n += 1;
    }
  }
  // 自分の公開投稿（しおりの Day 1 の 2 件。自動チェックの見た目に合わせる）
  for (const s of MY_ITINERARY.spots.filter((x) => x.checked)) {
    const id = randomUUID();
    const created = daysAgo(3);
    postRows.push({
      id,
      user_id: me.id,
      trip_id: myTripId,
      spot_id: spotRows[s.i].id,
      category: SPOTS[s.i].cat,
      visit_date: ymd(created),
      duration: "1時間以内",
      cost: 800,
      rating: 4,
      comment: "しおりどおりに回れた。次は朝もっと早く来たい。",
      visibility: "public",
      status: "published",
      lat: SPOTS[s.i].lat,
      lng: SPOTS[s.i].lng,
      created_at: created.toISOString(),
      published_at: created.toISOString(),
    });
    photoRows.push({ post_id: id, media_type: "photo", storage_url: PHOTO(`tabikoe-me-${s.i}`), display_order: 0 });
  }
  // 自分の下書き 4 件
  for (const [k, d] of MY_DRAFTS.entries()) {
    const spot = d.i === null ? null : SPOTS[d.i];
    postRows.push({
      id: randomUUID(),
      user_id: me.id,
      trip_id: myTripId,
      spot_id: d.i === null ? null : spotRows[d.i].id,
      category: spot ? spot.cat : null,
      visit_date: null,
      duration: null,
      cost: null,
      rating: null,
      comment: d.comment,
      visibility: "public",
      status: "draft",
      lat: spot ? spot.lat : d.lat,
      lng: spot ? spot.lng : d.lng,
      created_at: daysAgo(k).toISOString(),
      published_at: null,
    });
  }
  await must(admin.from("posts").insert(postRows), "posts");
  await must(admin.from("post_photos").insert(photoRows), "post_photos");
  console.log(`投稿: ${postRows.length} 件（下書き ${MY_DRAFTS.length}、非公開 2）、写真: ${photoRows.length} 枚`);

  // 5. いいね・コメント・まだあった報告（公開投稿にだけ）
  const published = postRows.filter((p) => p.status === "published" && p.visibility === "public");
  const likeRows = [];
  const commentRows = [];
  const statusRows = new Map();
  published.forEach((p, idx) => {
    const likers = users.filter((u) => u.id !== p.user_id).slice(0, idx % 4);
    likers.forEach((u) => likeRows.push({ post_id: p.id, user_id: u.id }));
    if (idx % 3 === 0 && p.user_id !== me.id) likeRows.push({ post_id: p.id, user_id: me.id });
    if (idx % 2 === 0) {
      const u = users[(idx + 1) % users.length];
      if (u.id !== p.user_id) commentRows.push({ post_id: p.id, user_id: u.id, body: pick(["行列すごかった？", "ここ気になってた！", "昼前が空いてるよ", "写真きれい", "今度行ってみます"], idx) });
    }
    if (idx % 5 === 0) {
      const u = users[(idx + 2) % users.length];
      statusRows.set(`${p.spot_id}:${u.id}`, { spot_id: p.spot_id, user_id: u.id, status: idx % 10 === 0 ? "still_there" : idx % 15 === 0 ? "gone" : "still_there" });
    }
  });
  await must(admin.from("likes").insert(likeRows), "likes");
  await must(admin.from("comments").insert(commentRows), "comments");
  await must(admin.from("spot_status_reports").insert([...statusRows.values()]), "spot_status_reports");
  console.log(`いいね: ${likeRows.length}、コメント: ${commentRows.length}、まだあった報告: ${statusRows.size}`);

  // 6. 自分の行きたい・しおり
  await must(admin.from("wishlist").insert(MY_WISHLIST.map((i) => ({ user_id: me.id, spot_id: spotRows[i].id }))), "wishlist");
  const itineraryId = randomUUID();
  await must(admin.from("itineraries").insert({ id: itineraryId, trip_id: myTripId, start_date: MY_ITINERARY.start, end_date: MY_ITINERARY.end }), "itineraries");
  // しおりのオーナー行も itineraries の挿入時に DB 側が自動で作るので、メンバーだけ入れる（みさき）
  await must(
    admin.from("itinerary_members").upsert({ itinerary_id: itineraryId, user_id: users[1].id, role: "member" }, { onConflict: "itinerary_id,user_id", ignoreDuplicates: true }),
    "itinerary_members"
  );
  await must(
    admin.from("itinerary_spots").insert(
      MY_ITINERARY.spots.map((s, order) => ({
        itinerary_id: itineraryId,
        spot_id: spotRows[s.i].id,
        day_index: s.day,
        arrival_time: s.time,
        sort_order: order,
        memo: s.memo,
        checked_at: s.checked ? daysAgo(3).toISOString() : null,
        checked_by: s.checked ? me.id : null,
      }))
    ),
    "itinerary_spots"
  );
  console.log(`行きたい: ${MY_WISHLIST.length}、しおり「${MY_ITINERARY.title}」: ${MY_ITINERARY.spots.length} スポット`);

  // 7. 自分宛の通知（コメント・いいね・しおり参加）
  const myPosts = postRows.filter((p) => p.user_id === me.id && p.status === "published");
  const notifRows = [];
  if (myPosts.length) {
    await must(admin.from("comments").insert({ post_id: myPosts[0].id, user_id: users[0].id, body: "しおり見せて〜" }), "comments(me)");
    await must(
      admin.from("likes").upsert([{ post_id: myPosts[0].id, user_id: users[0].id }, { post_id: myPosts[0].id, user_id: users[3].id }], { onConflict: "post_id,user_id", ignoreDuplicates: true }),
      "likes(me)"
    );
    notifRows.push({ user_id: me.id, type: "comment", related_id: myPosts[0].id }, { user_id: me.id, type: "like", related_id: myPosts[0].id });
  }
  notifRows.push({ user_id: me.id, type: "itinerary_joined", related_id: itineraryId }, { user_id: me.id, type: "album_join", related_id: myTripId });
  await must(admin.from("notifications").insert(notifRows), "notifications");
  console.log(`通知: ${notifRows.length}`);

  console.log("\n完了。消すときは: node scripts/seed/clean-seed.mjs");
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
