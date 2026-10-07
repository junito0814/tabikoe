// #777: 既にある seed の投稿写真を、場所に合うものに付け替える（1 投稿 1 枚・使い回しなし）
//
// 使い方:
//   node scripts/seed/fix-seed-photos.mjs          … 何が変わるか見るだけ（直さない）
//   node scripts/seed/fix-seed-photos.mjs --apply  … 実際に直す
//
// 【初心者向け】何が困っていたか。
//   写真は「食べ物のカテゴリなら食べ物、それ以外は風景」を**順ぐりに**割り当てていた。
//   そのせいで「神楽坂の石畳の路地」に厳島神社の海上鳥居が出たり、同じ鳥居が 2 つの投稿に
//   並んだりしていた（写真一覧で同じ写真が 2 枚）。
//
// 【初心者向け】どう直すか。
//   photos.json に**写真ごとに「どのスポットのものか」**（spot）を書いた。ここではそれだけを見る。
//     1. そのスポットの写真がある投稿 … 1 枚だけ残す（まだどの投稿にも使っていない写真なら付ける）
//     2. それ以外の投稿 … **写真を外す**
//   合わない写真を出すより、何も出さないほうがまし、という判断（#777）。
//   なので**直したあとは写真が付かない投稿のほうが多くなる**。これは意図どおり。
//
// seed の投稿かどうかは seed-ids.json のスポット id で見分ける（#776 と同じ）。
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { LEGACY_SEED_SPOT_SUFFIX } from "./seed-data.mjs";

const env = Object.fromEntries(
  readFileSync(new URL("../../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^"|"$/g, "")];
    })
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const apply = process.argv.includes("--apply");

const PHOTOS = JSON.parse(readFileSync(new URL("./photos.json", import.meta.url), "utf8"));
const PHOTO_BY_SPOT = new Map(PHOTOS.photos.filter((photo) => photo.spot).map((photo) => [photo.spot, `seed/${photo.file}`]));

async function must(promise, label) {
  const { data, error } = await promise;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

// 1. seed のスポットを集める（id の控え＋まだ印が残っている行）
const idsPath = new URL("./seed-ids.json", import.meta.url);
const savedSpotIds = existsSync(idsPath) ? (JSON.parse(readFileSync(idsPath, "utf8")).spotIds ?? []) : [];
const byId = savedSpotIds.length ? await must(admin.from("spots").select("id, name").in("id", savedSpotIds), "spots(id)") : [];
const byLegacy = await must(admin.from("spots").select("id, name").like("name", `%${LEGACY_SEED_SPOT_SUFFIX}`), "spots(印)");
const spots = new Map();
for (const row of [...byId, ...byLegacy]) spots.set(row.id, row.name.replace(new RegExp(`${LEGACY_SEED_SPOT_SUFFIX}$`), ""));
console.log(`${apply ? "【直します】" : "【見るだけ】（--apply を付けると直します）"}\n`);
console.log(`seed のスポット: ${spots.size} 件 / 場所に合う写真: ${PHOTO_BY_SPOT.size} 枚`);

// 2. そのスポットの投稿と、今ついている写真
const posts = await must(
  admin.from("posts").select("id, spot_id, created_at").in("spot_id", [...spots.keys()]).order("created_at"),
  "posts"
);
const photos = await must(admin.from("post_photos").select("id, post_id, storage_url").in("post_id", posts.map((p) => p.id)), "post_photos");
const photosByPost = new Map();
for (const photo of photos) photosByPost.set(photo.post_id, [...(photosByPost.get(photo.post_id) ?? []), photo]);
console.log(`seed の投稿: ${posts.length} 件 / いま付いている写真: ${photos.length} 枚（別々のファイル ${new Set(photos.map((p) => p.storage_url)).size} 種類）\n`);

// 3. どの投稿にどの写真を付けるかを決める（1 枚ずつ・使い回しなし。古い投稿から順に）
const used = new Set();
const keep = new Map(); // post_id -> storage_url
for (const post of posts) {
  const wanted = PHOTO_BY_SPOT.get(spots.get(post.spot_id));
  if (!wanted || used.has(wanted)) continue;
  used.add(wanted);
  keep.set(post.id, wanted);
}

const toInsert = [];
const toDelete = [];
for (const post of posts) {
  const current = photosByPost.get(post.id) ?? [];
  const wanted = keep.get(post.id);
  if (!wanted) {
    toDelete.push(...current);
    continue;
  }
  const match = current.find((photo) => photo.storage_url === wanted);
  if (match) toDelete.push(...current.filter((photo) => photo.id !== match.id));
  else {
    toDelete.push(...current);
    toInsert.push({ post_id: post.id, media_type: "photo", storage_url: wanted, display_order: 0 });
  }
}

console.log(`付け替える／付ける: ${toInsert.length} 枚`);
for (const row of toInsert) {
  const post = posts.find((p) => p.id === row.post_id);
  console.log(`  ${spots.get(post.spot_id)} ← ${row.storage_url}`);
}
console.log(`\n外す: ${toDelete.length} 枚（場所に合わない／1 投稿 2 枚目以降／使い回し）`);
console.log(`直したあと: 写真が付く投稿 ${keep.size} 件 / 付かない投稿 ${posts.length - keep.size} 件`);

const unusable = PHOTOS.photos.filter((photo) => !photo.spot);
if (unusable.length > 0) {
  console.log(`\n使わない写真: ${unusable.length} 枚`);
  for (const photo of unusable) console.log(`  ${photo.file}: ${photo.why}`);
}

if (!apply) {
  console.log("\n直していません。--apply を付けると直します");
  process.exit(0);
}

if (toDelete.length > 0) {
  await must(admin.from("post_photos").delete().in("id", toDelete.map((photo) => photo.id)).select("id"), "post_photos(delete)");
}
if (toInsert.length > 0) {
  await must(admin.from("post_photos").insert(toInsert).select("id"), "post_photos(insert)");
}
console.log(`\n直しました: ${toInsert.length} 枚を付け、${toDelete.length} 枚を外しました`);
