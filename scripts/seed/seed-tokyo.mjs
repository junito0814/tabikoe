// ダミーデータ（東京中心・約 50 投稿）を Supabase に入れる。消すときは `node scripts/seed/clean-seed.mjs`。
//
// 使い方:  node scripts/seed/seed-tokyo.mjs [--me you@example.com]
//   - .env.local の NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SECRET_KEY（service_role）を使う
//   - --me を省略すると junitodaze0814@gmail.com を「自分」として扱う（users テーブルに居ること）
//
// 【初心者向け】このスクリプトが作った行の見分け方（#776 で変えた）。
//   - ダミーユーザー: email が `seed-*@example.invalid`（画面には出ない値）
//   - スポット・旅行（アルバム）: **入れた id を scripts/seed/seed-ids.json に書き出す**
//   - 投稿・写真・コメント・いいね・行きたい・しおり・通知: 上のユーザー／スポット／旅行に紐づくので、それを消せば一緒に消える（外部キーの cascade）
//   あなた自身の行（自分の投稿・下書き・行きたい・しおりの参加）は「seed のスポット／旅行」に紐づくものだけ作るので、
//   clean-seed.mjs がスポットと旅行を消せば、あなたの seed 由来の行だけが消えて、それ以外のあなたのデータは残る。
//
//   #776 より前は**名前に印**（スポット名の末尾「（seed）」、ユーザー名の先頭「[seed] 」）を付けていたが、
//   それが画面に出ていた（発表のときに見える）ので付けるのをやめた。代わりが seed-ids.json。
//   名前で消すのは危険: 利用者が自分で「東京タワー」を作っていることがあり、**本物まで消える**。
import { connect } from "../supabase-target.mjs";
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { DUMMY_USERS, MY_TRIP_TITLE, SEED_EMAIL_DOMAIN, SPOT_POSTS, SPOTS, TRIP_TITLES } from "./seed-data.mjs";

// ---- .env.local を読む（dotenv を入れていないので自前で） ----
const { admin, env, target } = await connect();

// #703: スポットの Place ID（node scripts/seed/resolve-place-ids.mjs で作る）
const PLACE_IDS = JSON.parse(readFileSync(new URL("./place-ids.json", import.meta.url), "utf8"));

const meEmail = process.argv.includes("--me") ? process.argv[process.argv.indexOf("--me") + 1] : "junitodaze0814@gmail.com";

// ---- ダミーユーザー・スポットの定義は seed-data.mjs（消す側と共有）----



// #703: 写真は Pixabay から取り、Supabase Storage に入れてからそのパスを保存する。
// 外部の URL を貼りっぱなしにしない（向こうが変われば本番の見た目も変わるため）。
// 取得元・取得日・人が写っていないことの確認は photos.json に書いてある。
const PHOTOS = JSON.parse(readFileSync(new URL("./photos.json", import.meta.url), "utf8"));
const SEED_PHOTO_PREFIX = "seed/";

/*
 * #893: スポット名 → そのスポットの写真（1〜3 枚、順番つき）。
 *
 * 【初心者向け】#777 までは写真が 16 枚しか無く、「1 投稿 1 枚・使い回さない・合わなければ付けない」
 * という決まりだったため、**76 投稿のうち 62 件に写真が付いていなかった**。
 * 提出用のデータとしてそれでは成立しないので、スポット 51 件それぞれに写真を用意した（86 枚）。
 *
 *   - **投稿が 1 件だけのスポット** … その投稿にそのスポットの写真を**全部**載せる（＝複数枚の投稿になる）
 *   - **投稿が 2 件あるスポット** … 1 件目に 1 枚目、2 件目に 2 枚目（同じ写真が 2 投稿に出ない）
 *
 * 写真の出どころ・ライセンス・目視確認の記録は photos.json にある。
 */
const PHOTOS_BY_SPOT = new Map();
for (const photo of [...PHOTOS.photos].sort((a, b) => a.order - b.order)) {
  const list = PHOTOS_BY_SPOT.get(photo.spot) ?? [];
  list.push(`${SEED_PHOTO_PREFIX}${photo.file}`);
  PHOTOS_BY_SPOT.set(photo.spot, list);
}

/*
 * #893: **投稿を作らないスポット**。
 * 写真とスポットの結び付きが弱い（Pixabay に合う写真が無く、近いものしか用意できなかった）5 件は
 * 投稿を作らず、地図のピンと「行きたい」の対象としてだけ残す。合わない写真を見せるより、
 * **その場所の投稿がまだ無い**という状態のほうが正しい。
 */
const SPOTS_WITHOUT_POSTS = new Set([
  "赤城神社カフェ",
  "代々木公園の日曜マーケット",
  "麻布十番の温泉銭湯",
  "築地の卵焼き屋（行列なし）",
  "神楽坂の石畳の路地",
]);

/** #893: 2 件目の投稿も作るスポット（スポット投稿一覧に複数件並ぶ様子を見せるため） */
const SPOTS_WITH_TWO_POSTS = new Set(["東京スカイツリー", "築地場外市場", "渋谷スクランブル交差点", "新宿 思い出横丁"]);

/*
 * #896: 写真を取ってきて Storage に入れる。
 *
 * 【初心者向け】なぜ「取り直す」処理が要るのか。
 *   photos.json に控えてある URL（Pixabay の largeImageURL）は、**しばらくすると無効になります**。
 *   2026-10-07 に書き出した URL が、2026-10-09 には HTTP 400 を返すようになっていました。
 *   一方 **写真の id（pixabayId）は変わりません**。そこで、控えの URL をまず試し、
 *   だめなら id から今の URL を聞き直します。これで何か月あとでも seed を流し直せます。
 */
async function fetchPixabayUrlById(id) {
  const key = env.PIXABAY_API_KEY;
  if (!key) throw new Error(".env.local に PIXABAY_API_KEY がありません（写真の URL を取り直すのに要ります）");
  const response = await fetch(`https://pixabay.com/api/?key=${key}&id=${id}`);
  if (!response.ok) throw new Error(`Pixabay に聞けませんでした: id=${id}（HTTP ${response.status}）`);
  const body = await response.json();
  const hit = body.hits?.[0];
  if (!hit?.largeImageURL) throw new Error(`Pixabay に id=${id} の写真がありません（取り下げられた可能性）`);
  return hit.largeImageURL;
}

/** 控えの URL → だめなら id から取り直し。中身（Uint8Array）を返す */
async function downloadSeedPhoto(photo) {
  const first = await fetch(photo.url).catch(() => null);
  if (first?.ok) return new Uint8Array(await first.arrayBuffer());
  const fresh = await fetchPixabayUrlById(photo.pixabayId);
  const retry = await fetch(fresh);
  if (!retry.ok) throw new Error(`写真を取れませんでした: ${photo.file}（HTTP ${retry.status}）`);
  return new Uint8Array(await retry.arrayBuffer());
}

async function uploadSeedPhotos() {
  console.log(`写真: Pixabay から ${PHOTOS.photos.length} 枚を取って Storage に入れます`);
  let done = 0;
  for (const photo of PHOTOS.photos) {
    const body = await downloadSeedPhoto(photo);
    const { error } = await admin.storage
      .from("post-media")
      .upload(`${SEED_PHOTO_PREFIX}${photo.file}`, body, { contentType: "image/jpeg", upsert: true });
    if (error) throw new Error(`Storage に入れられませんでした: ${photo.file}（${error.message}）`);
    done += 1;
    if (done % 20 === 0) console.log(`  ${done} / ${PHOTOS.photos.length} 枚`);
  }
  console.log(`写真: ${PHOTOS.photos.length} 枚を入れました（${SEED_PHOTO_PREFIX}）`);
}

// 「自分」のしおり（東京 2 泊 3 日）に入れるスポット（SPOTS の index）
const MY_ITINERARY = {
  title: MY_TRIP_TITLE,
  start: "2026-10-10",
  end: "2026-10-12",
  spots: [
    { i: 0, day: 1, time: "09:30", memo: "朝イチで", checked: false },
    { i: 2, day: 1, time: "11:00", memo: "包丁を見る", checked: true },
    { i: 4, day: 1, time: "14:00", memo: "" , checked: false },
    { i: 3, day: 1, time: null, memo: "夜景", checked: false },
    { i: 14, day: 2, time: "08:00", memo: "朝ごはん", checked: false },
    { i: 16, day: 2, time: "10:30", memo: "", checked: true },
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

  // 0.5 写真を Storage に入れる（#703）。投稿より先にやる
  await uploadSeedPhotos();

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
      user_metadata: { full_name: u.name, seed: true },
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
          display_name: u.name,
          // #703: 外部の顔写真をやめ、アプリの既定のアイコンにする
          avatar_url: "/default-avatar.svg",
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
  // #703・#700: Place ID を付ける（place-ids.json。Google から保存してよい唯一の値）
  const placeIdOf = new Map(PLACE_IDS.spots.map((row) => [row.name, row.placeId]));
  const spotRows = SPOTS.map((s) => ({
    id: randomUUID(),
    name: s.name,
    lat: s.lat,
    lng: s.lng,
    prefecture: s.pref ?? "東京都",
    source: s.source,
    place_id: placeIdOf.get(s.name) ?? null,
  }));
  await must(admin.from("spots").insert(spotRows), "spots");
  console.log(`スポット: ${spotRows.length} 件`);

  // 3. 旅行（アルバム）。ダミーユーザーそれぞれ 1〜2 つ＋自分のしおり用 1 つ
  const tripRows = [];
  const tripOf = {}; // userKey -> [tripId...]
  for (const u of users) {
    const titles = TRIP_TITLES[u.key];
    tripOf[u.key] = [];
    for (const t of titles) {
      const id = randomUUID();
      tripRows.push({ id, user_id: u.id, title: t });
      tripOf[u.key].push(id);
    }
  }
  const myTripId = randomUUID();
  tripRows.push({ id: myTripId, user_id: me.id, title: MY_ITINERARY.title });
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

  // 4. 投稿（#893: 50 件。うち非公開 2 件）。感想・費用・星は SPOT_POSTS にスポットごとに書いてある
  const postRows = [];
  const photoRows = [];

  /*
   * #893: どのスポットに何件の投稿を作るかを**先に決める**。
   * 先に決めておかないと「このスポットの投稿は 1 件だけか」が分からず、
   * 「1 件だけなら写真を全部載せる」という割り振りができない。
   * 「自分」の投稿もここで数に入れる（しおりでチェック済みのスポット）。
   */
  const myPostSpotIndexes = MY_ITINERARY.spots.filter((x) => x.checked).map((x) => x.i);
  const plannedCount = new Map(); // スポット名 -> 投稿の件数
  for (let i = 0; i < SPOTS.length; i += 1) {
    const name = SPOTS[i].name;
    let count = SPOTS_WITHOUT_POSTS.has(name) ? 0 : 1;
    if (SPOTS_WITH_TWO_POSTS.has(name)) count += 1;
    if (myPostSpotIndexes.includes(i)) count += 1;
    plannedCount.set(name, count);
  }

  /** そのスポットの写真を、順番に切り出していく（使い切ったら空） */
  const photoQueue = new Map([...PHOTOS_BY_SPOT].map(([name, list]) => [name, [...list]]));
  /**
   * 投稿 1 件に載せる写真を取り出す。
   * 投稿が 1 件しかないスポットは**残り全部**（複数枚の投稿になる）、
   * 2 件以上あるスポットは 1 枚ずつ（同じ写真が 2 投稿に出ないように）。
   */
  function takePhotos(spotName) {
    const queue = photoQueue.get(spotName) ?? [];
    if (queue.length === 0) return [];
    return (plannedCount.get(spotName) ?? 1) <= 1 ? queue.splice(0, queue.length) : queue.splice(0, 1);
  }
  function attachPhotos(postId, spotName) {
    takePhotos(spotName).forEach((path, order) => {
      photoRows.push({ post_id: postId, media_type: "photo", storage_url: path, display_order: order });
    });
  }

  let n = 0;
  for (let i = 0; i < spotRows.length; i += 1) {
    const spot = SPOTS[i];
    if (SPOTS_WITHOUT_POSTS.has(spot.name)) continue;
    const entries = SPOT_POSTS[spot.name];
    if (!entries) throw new Error(`SPOT_POSTS に「${spot.name}」がありません（seed-data.mjs）`);
    const count = SPOTS_WITH_TWO_POSTS.has(spot.name) ? 2 : 1;
    for (let k = 0; k < count; k += 1) {
      const entry = entries[k];
      if (!entry) throw new Error(`SPOT_POSTS「${spot.name}」の ${k + 1} 件目がありません`);
      const u = users[(i + k) % users.length];
      const trip = pick(tripOf[u.key], k);
      const created = daysAgo(1 + ((i * 7 + k * 3) % 120));
      const visit = daysAgo(2 + ((i * 7 + k * 3) % 120));
      const id = randomUUID();
      const isPrivate = n === 5 || n === 23;
      postRows.push({
        id,
        user_id: u.id,
        trip_id: trip,
        spot_id: spotRows[i].id,
        category: spot.cat,
        visit_date: ymd(visit),
        duration: spot.cat === "宿泊施設" ? "宿泊" : entry.d,
        cost: entry.cost,
        rating: entry.r,
        comment: entry.c,
        visibility: isPrivate ? "private" : "public",
        status: "published",
        lat: spot.lat,
        lng: spot.lng,
        created_at: created.toISOString(),
        published_at: created.toISOString(),
      });
      attachPhotos(id, spot.name);
      n += 1;
    }
  }
  // 自分の公開投稿（しおりでチェック済みのスポット。自動チェックの見た目に合わせる）
  const MY_COMMENTS = [
    "しおりに入れておいた順にそのまま回れた。次は朝をもっと早くしたい。",
    "歩きどおしだったが、このへんは一本道なので迷わなかった。昼を挟むとちょうどいい。",
  ];
  for (const [k, sp] of MY_ITINERARY.spots.filter((x) => x.checked).entries()) {
    const id = randomUUID();
    const created = daysAgo(3 + k);
    postRows.push({
      id,
      user_id: me.id,
      trip_id: myTripId,
      spot_id: spotRows[sp.i].id,
      category: SPOTS[sp.i].cat,
      visit_date: ymd(created),
      duration: "1時間以内",
      cost: 800,
      rating: 4,
      comment: MY_COMMENTS[k % MY_COMMENTS.length],
      visibility: "public",
      status: "published",
      lat: SPOTS[sp.i].lat,
      lng: SPOTS[sp.i].lng,
      created_at: created.toISOString(),
      published_at: created.toISOString(),
    });
    attachPhotos(id, SPOTS[sp.i].name);
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
  const withoutPhoto = postRows.filter((p) => p.status === "published" && !photoRows.some((ph) => ph.post_id === p.id));
  if (withoutPhoto.length > 0) throw new Error(`写真が付いていない公開投稿が ${withoutPhoto.length} 件あります（#893 の受入条件に反する）`);
  console.log(`投稿: ${postRows.length} 件（下書き ${MY_DRAFTS.length}、非公開 2）、写真: ${photoRows.length} 枚`);
  console.log(`  うち写真が 2 枚以上の投稿: ${new Set(photoRows.map((p) => p.post_id)).size === photoRows.length ? 0 : postRows.filter((p) => photoRows.filter((ph) => ph.post_id === p.id).length >= 2).length} 件`);

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

  /*
   * 8. 入れた行の id を書き出す（#776）。
   *
   * 【初心者向け】名前の印をやめたので、**あとで消すときの手がかりがここだけ**になる。
   * id は環境ごとに違う（ローカルと本番で別物）ので、この file は git に入れない（.gitignore）。
   * 消すときは `node scripts/seed/clean-seed.mjs` が、この file を読んで該当の行だけ消す。
   */
  writeFileSync(
    new URL("./seed-ids.json", import.meta.url),
    `${JSON.stringify(
      {
        note: "seed-tokyo.mjs が入れた行の id。clean-seed.mjs が読む。環境ごとに違うので git には入れない",
        writtenAt: new Date().toISOString(),
        supabaseUrl: target.url,
        userIds: users.map((u) => u.id),
        spotIds: spotRows.map((s) => s.id),
        tripIds: tripRows.map((t) => t.id),
      },
      null,
      2
    )}\n`
  );
  console.log("入れた行の id: scripts/seed/seed-ids.json に書き出しました");

  console.log("\n完了。消すときは: node scripts/seed/clean-seed.mjs");
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
