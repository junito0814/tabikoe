// #776: 既にある行から「（seed）」「[seed] 」の印を外す
//
// 使い方:
//   node scripts/seed/strip-seed-markers.mjs          … 何が変わるか見るだけ（直さない）
//   node scripts/seed/strip-seed-markers.mjs --apply  … 実際に直す
//
// 【初心者向け】なぜ外すのか。
//   スポット名の「（seed）」、ユーザー名の「[seed] 」が**そのまま画面に出ていました**。
//   発表のときに見えるので外します（#776）。
//
// 【初心者向け】外す前に id を控えるのが大事。
//   この印は「どれが seed か」を見分ける唯一の手がかりでした。外した瞬間に見分けが付かなくなるので、
//   **外すのと同時に id を scripts/seed/seed-ids.json に書き出します**。
//   あとで `clean-seed.mjs` がその file を読んで、seed だけを消せるようにしておくためです。
//   （名前で消すのは危険: 利用者が自分で「東京タワー」を作っていることがあり、本物まで消えます）
import { connect } from "../supabase-target.mjs";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { LEGACY_SEED_SPOT_SUFFIX, LEGACY_SEED_TAG, SEED_EMAIL_DOMAIN } from "./seed-data.mjs";

const { admin, target } = await connect();
const apply = process.argv.includes("--apply");
const idsPath = new URL("./seed-ids.json", import.meta.url);

async function must(promise, label) {
  const { data, error } = await promise;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

console.log(apply ? "【直します】" : "【見るだけ】（--apply を付けると直します）");

// 1. スポット: 末尾の「（seed）」
const spots = await must(admin.from("spots").select("id, name").like("name", `%${LEGACY_SEED_SPOT_SUFFIX}`), "spots");
console.log(`\nスポット: ${spots.length} 件`);
for (const s of spots.slice(0, 5)) console.log(`  ${s.name} → ${s.name.slice(0, -LEGACY_SEED_SPOT_SUFFIX.length)}`);
if (spots.length > 5) console.log(`  …ほか ${spots.length - 5} 件`);

// 2. ユーザー: 先頭の「[seed] 」。seed のダミーユーザーに限る（email で確かめる）
const users = await must(
  admin.from("users").select("id, email, display_name").like("email", `seed-%@${SEED_EMAIL_DOMAIN}`),
  "users"
);
const taggedUsers = users.filter((u) => u.display_name?.startsWith(LEGACY_SEED_TAG));
console.log(`\nユーザー: ${taggedUsers.length} 人`);
for (const u of taggedUsers) console.log(`  ${u.display_name} → ${u.display_name.slice(LEGACY_SEED_TAG.length)}`);

// 3. 旅行（アルバム）: 先頭の「[seed] 」
const trips = await must(admin.from("trips").select("id, title").like("title", `${LEGACY_SEED_TAG}%`), "trips");
console.log(`\n旅行（アルバム）: ${trips.length} 件`);
for (const t of trips) console.log(`  ${t.title} → ${t.title.slice(LEGACY_SEED_TAG.length)}`);

if (!apply) {
  console.log("\n直していません。--apply を付けると直します");
  process.exit(0);
}

/*
 * 直す前に id を控える。既に seed-ids.json があれば**足す**（上書きで前の控えを失わないように）。
 */
const before = existsSync(idsPath) ? JSON.parse(readFileSync(idsPath, "utf8")) : {};
const merge = (a, b) => [...new Set([...(a ?? []), ...b])];
writeFileSync(
  idsPath,
  `${JSON.stringify(
    {
      note: "seed の行の id。clean-seed.mjs が読む。環境ごとに違うので git には入れない",
      writtenAt: new Date().toISOString(),
      supabaseUrl: target.url,
      userIds: merge(before.userIds, users.map((u) => u.id)),
      spotIds: merge(before.spotIds, spots.map((s) => s.id)),
      tripIds: merge(before.tripIds, trips.map((t) => t.id)),
    },
    null,
    2
  )}\n`
);
console.log(`\nid を控えました: scripts/seed/seed-ids.json`);

for (const s of spots) {
  await must(admin.from("spots").update({ name: s.name.slice(0, -LEGACY_SEED_SPOT_SUFFIX.length) }).eq("id", s.id).select("id"), `spots(${s.id})`);
}
for (const u of taggedUsers) {
  await must(admin.from("users").update({ display_name: u.display_name.slice(LEGACY_SEED_TAG.length) }).eq("id", u.id).select("id"), `users(${u.id})`);
}
for (const t of trips) {
  await must(admin.from("trips").update({ title: t.title.slice(LEGACY_SEED_TAG.length) }).eq("id", t.id).select("id"), `trips(${t.id})`);
}
console.log(`\n直しました: スポット ${spots.length} 件 / ユーザー ${taggedUsers.length} 人 / 旅行 ${trips.length} 件`);
