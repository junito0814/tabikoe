// 同じ名前の seed スポットが二重になっているとき、古い方を消す（2026-10-06 の後始末）
//
// 使い方:
//   node scripts/seed/clean-duplicate-spots.mjs          … 何が消えるか見るだけ（消さない）
//   node scripts/seed/clean-duplicate-spots.mjs --apply  … 実際に消す
//
// 【初心者向け】なぜこれが要るのか。
//   `clean-seed.mjs` は **投稿が残っているスポットを消せない**（消すと中の投稿も一緒に消えるため、
//   わざとそうしている）。そのため「自分の下書きが付いている seed スポット」があると、そこで止まる。
//   止まったまま `seed-tokyo.mjs` を動かすと、同じ名前のスポットが 2 つ並ぶ。
//
// このスクリプトの決まり（安全のため、かなり厳しくしてある）
//   1. **seed のスポットだけ**を見る（#776 より前は名前の「（seed）」で見分けていたが、
//      印を画面から外したので、いまは seed-ids.json の控え＋まだ印が残っている行で見分ける）
//   2. **同じ名前が 2 つ以上あるときだけ**動く（1 つしかない名前は触らない）
//   3. そのうち **いちばん新しいものは必ず残す**
//   4. 古い方も、**投稿が 1 件でもあれば残す**（下書きを含む。消えると取り返せないため）
//   → 結果として「投稿が無く、同じ名前の新しいものがある古いスポット」だけが消える
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
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error(".env.local に NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY が要ります");
const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const apply = process.argv.includes("--apply");

/*
 * seed のスポットを集める（#776）。
 *
 * 【初心者向け】ここで**名前では選ばない**のが大事。利用者が自分で「東京タワー」を作っていることがあり、
 * 名前で選ぶと本物まで消す候補に入ってしまう。seed-tokyo.mjs が書き出した id の控えを使う。
 * 控えが無い古い環境のために、まだ印が残っている行も拾う。
 */
const idsPath = new URL("./seed-ids.json", import.meta.url);
const savedSpotIds = existsSync(idsPath) ? (JSON.parse(readFileSync(idsPath, "utf8")).spotIds ?? []) : [];
const byId = savedSpotIds.length
  ? (await admin.from("spots").select("id, name, created_at").in("id", savedSpotIds)).data ?? []
  : [];
const { data: byLegacy, error } = await admin.from("spots").select("id, name, created_at").like("name", `%${LEGACY_SEED_SPOT_SUFFIX}`);
if (error) throw new Error(`spots: ${error.message}`);
const spotsById = new Map();
for (const row of [...byId, ...byLegacy]) spotsById.set(row.id, row);
const spots = [...spotsById.values()];
console.log(`seed のスポット: ${spots.length} 件`);

// 1・2: 名前ごとにまとめ、2 つ以上あるものだけ
const byName = new Map();
for (const spot of spots) byName.set(spot.name, [...(byName.get(spot.name) ?? []), spot]);
const duplicated = [...byName.entries()].filter(([, rows]) => rows.length > 1);
console.log(`同じ名前が 2 つ以上あるもの: ${duplicated.length} 種類`);
if (duplicated.length === 0) {
  console.log("二重になっているものはありません。何もしません。");
  process.exit(0);
}

// 3: いちばん新しいものを残し、残りを候補にする
const candidates = duplicated.flatMap(([, rows]) => {
  const sorted = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return sorted.slice(1);
});

// 4: 投稿（下書きを含む）が 1 件でもあるものは残す
const { data: posts, error: postsError } = await admin.from("posts").select("spot_id").in("spot_id", candidates.map((s) => s.id));
if (postsError) throw new Error(`posts: ${postsError.message}`);
const hasPost = new Set((posts ?? []).map((p) => p.spot_id));
const removable = candidates.filter((spot) => !hasPost.has(spot.id));
const kept = candidates.filter((spot) => hasPost.has(spot.id));

console.log(`\n消す: ${removable.length} 件（投稿が無く、同じ名前の新しいものがある）`);
for (const spot of removable.slice(0, 5)) console.log(`  ${spot.created_at.slice(0, 10)} ${spot.name}`);
if (removable.length > 5) console.log(`  …ほか ${removable.length - 5} 件`);

if (kept.length > 0) {
  console.log(`\n残す: ${kept.length} 件（投稿が付いているため。消すと投稿ごと消える）`);
  for (const spot of kept) console.log(`  ${spot.created_at.slice(0, 10)} ${spot.name}`);
  console.log("  → こちらも消したい場合は、先にその投稿（下書きを含む）を画面から消してください");
}

if (!apply) {
  console.log("\n（これは下見です。実際に消すには --apply を付けてください）");
  process.exit(0);
}
if (removable.length === 0) {
  console.log("\n消すものはありません。");
  process.exit(0);
}

// スポットを指している行を先に消す（clean-seed.mjs と同じ順番）
const ids = removable.map((spot) => spot.id);
for (const table of ["wishlist", "spot_status_reports", "itinerary_spots"]) {
  const { error: relError } = await admin.from(table).delete().in("spot_id", ids);
  if (relError) throw new Error(`${table}: ${relError.message}`);
}
const { error: deleteError } = await admin.from("spots").delete().in("id", ids);
if (deleteError) throw new Error(`spots(delete): ${deleteError.message}`);
console.log(`\n${removable.length} 件を消しました。`);
