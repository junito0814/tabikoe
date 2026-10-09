// #903: 索引の有無で実際に差が出るかを、開発用の Supabase で測る。
//
// 使い方:
//   BENCH_POSTS=6000 node scripts/bench-index.mjs seed    … 測定用の行を入れる
//   node scripts/bench-index.mjs measure                  … 測る
//   node scripts/bench-index.mjs clean                    … 測定用の行を消す
//
// 【初心者向け】なぜこれが要るのか。
//   「索引を足せば速くなる」は**思い込みになりがち**です。足せば書き込みは少し遅くなるので、
//   効かない索引を増やすのは損です。Issue #903 は「**差が出ないなら入れない**」と決めました。
//   それを確かめるには、実際にその規模のデータを入れて測るしかありません。
//
//   入れる行には印（`__index-benchmark__` という題名の旅行）を付けてあるので、
//   `clean` で**その行だけ**を消せます。seed で入れた本物のダミーデータは残ります。
//
//   **本番では走りません**（supabase-target.mjs の既定が開発用で、ここでも念のため確かめています）。
import { connect } from "./scripts/supabase-target.mjs";
import { randomUUID } from "node:crypto";

const { admin, target } = await connect();
if (target.isProduction) throw new Error("本番では走らせない");

const MARK = "__index-benchmark__";
const POSTS = Number(process.env.BENCH_POSTS ?? 6000);

async function must(p, label) {
  const { data, error } = await p;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

async function benchTrip() {
  const { data } = await admin.from("trips").select("id").eq("title", MARK).maybeSingle();
  return data?.id ?? null;
}

if (process.argv[2] === "seed") {
  const users = await must(admin.from("users").select("id").limit(1), "users");
  const spots = await must(admin.from("spots").select("id, lat, lng").limit(60), "spots");
  const userId = users[0].id;
  let tripId = await benchTrip();
  if (!tripId) {
    tripId = randomUUID();
    await must(admin.from("trips").insert({ id: tripId, user_id: userId, title: MARK }), "trips");
  }
  const rows = [];
  const photos = [];
  for (let i = 0; i < POSTS; i += 1) {
    const spot = spots[i % spots.length];
    const id = randomUUID();
    rows.push({
      id,
      user_id: userId,
      trip_id: tripId,
      spot_id: spot.id,
      category: "グルメ",
      visit_date: "2026-01-01",
      duration: "1時間以内",
      cost: 500,
      rating: 4,
      comment: `測定用 ${i}`,
      visibility: "public",
      status: "published",
      lat: spot.lat,
      lng: spot.lng,
      created_at: new Date(Date.now() - i * 60000).toISOString(),
      published_at: new Date(Date.now() - i * 60000).toISOString(),
    });
    photos.push({ post_id: id, media_type: "photo", storage_url: "seed/s00-1.jpg", display_order: 0 });
  }
  for (let i = 0; i < rows.length; i += 500) {
    await must(admin.from("posts").insert(rows.slice(i, i + 500)), "posts");
    await must(admin.from("post_photos").insert(photos.slice(i, i + 500)), "post_photos");
    process.stdout.write(`\r  ${Math.min(i + 500, rows.length)} / ${rows.length}`);
  }
  console.log(`\n測定用に ${POSTS} 件入れました（印: ${MARK}）`);
  process.exit(0);
}

if (process.argv[2] === "clean") {
  const tripId = await benchTrip();
  if (!tripId) {
    console.log("測定用の行はありません");
    process.exit(0);
  }
  // PostgREST は既定で 1,000 行までしか返さないので、無くなるまで繰り返す
  let removed = 0;
  for (;;) {
    const batch = await must(admin.from("posts").select("id").eq("trip_id", tripId).limit(500), "posts(find)");
    if (batch.length === 0) break;
    await must(admin.from("posts").delete().in("id", batch.map((p) => p.id)), "posts(delete)");
    removed += batch.length;
    process.stdout.write(`\r  ${removed} 件`);
  }
  await must(admin.from("trips").delete().eq("id", tripId), "trips(delete)");
  console.log(`\n測定用の ${removed} 件を消しました`);
  process.exit(0);
}

// measure
const spots = await must(admin.from("spots").select("id").limit(1), "spots");
const spotId = spots[0].id;
const { count: total } = await admin.from("posts").select("*", { head: true, count: "exact" });
console.log(`いまの投稿数: ${total} 件\n`);

async function time(label, run, rounds = 7) {
  const times = [];
  for (let i = 0; i < rounds; i += 1) {
    const start = performance.now();
    await run();
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  console.log(`  ${label.padEnd(42)} 中央値 ${times[Math.floor(rounds / 2)].toFixed(0)} ms  （最小 ${times[0].toFixed(0)} / 最大 ${times.at(-1).toFixed(0)}）`);
}

await time("スポット別の一覧（spot_id で絞って新着順）", () =>
  admin.from("posts").select("id, published_at").eq("spot_id", spotId).eq("visibility", "public").eq("status", "published").is("hidden_at", null).order("published_at", { ascending: false }).range(0, 19)
);
await time("そのスポットの件数（count）", () =>
  admin.from("posts").select("id", { count: "exact", head: true }).eq("spot_id", spotId).eq("visibility", "public").eq("status", "published").is("hidden_at", null)
);
const some = await must(admin.from("posts").select("id").limit(20), "posts(ids)");
await time("カード 20 枚ぶんの写真（post_id in …）", () =>
  admin.from("post_photos").select("post_id, storage_url").in("post_id", some.map((p) => p.id))
);
