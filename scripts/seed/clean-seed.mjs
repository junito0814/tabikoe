// seed-tokyo.mjs が入れたダミーデータを全部消す。
//
// 使い方:
//   node scripts/seed/clean-seed.mjs          … 何が消えるか見るだけ（消さない）
//   node scripts/seed/clean-seed.mjs --apply  … 実際に消す
//
// 【初心者向け】どうやって「どれが seed か」を見分けるか（#776 で変えた）。
//   むかしは**名前の印**（スポット名の末尾「（seed）」、ユーザー名の先頭「[seed] 」）で見分けていたが、
//   その印が画面に出ていたのでやめた。いまの手がかりは 2 つ:
//     a. ダミーユーザー … email が `seed-*@example.invalid`（画面に出ない値なので、そのまま使える）
//     b. スポット・旅行 … **scripts/seed/seed-ids.json**（seed-tokyo.mjs / strip-seed-markers.mjs が書き出した id の控え）
//   保険として、まだ印が残っている行（古い環境）も拾う。
//
//   **名前だけで消してはいけない。** 利用者が自分で「東京タワー」を作っていることがあり、
//   名前で消すと本物まで消える。だから id の控えを使う。
//
// 【初心者向け】消す順番と理由:
//   1. ダミーユーザーを auth から削除 → users は cascade で消え、
//      その人の投稿・写真・コメント・いいね・行きたい・アルバム参加・しおり参加も cascade で消える
//   2. 旅行を削除 → 自分のしおり・しおりのスポット・メンバー・自分の投稿（seed の旅行に紐づくもの）・下書きが消える
//   3. スポットを削除 → まだあった報告・行きたい が消える
//      （投稿は spot_id が on delete restrict なので、先に 1・2 で投稿を消してから）
//   4. 自分宛の通知のうち related_id が消えたものを削除
//   あなたの seed 以外のデータ（自分で作った投稿・旅行・行きたい）には触らない。
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { LEGACY_SEED_SPOT_SUFFIX, LEGACY_SEED_TAG, SEED_EMAIL_DOMAIN } from "./seed-data.mjs";

const env = Object.fromEntries(
  readFileSync(new URL("../../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^"|"$/g, "")];
    })
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const apply = process.argv.includes("--apply");

/** seed-tokyo.mjs / strip-seed-markers.mjs が書き出した id の控え（無ければ空） */
const idsPath = new URL("./seed-ids.json", import.meta.url);
const SAVED = existsSync(idsPath) ? JSON.parse(readFileSync(idsPath, "utf8")) : {};

async function must(promise, label) {
  const { data, error } = await promise;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

/**
 * seed の行を集める。id の控え（seed-ids.json）＋ まだ印が残っている行（古い環境の保険）。
 * **名前が一致するだけの行は拾わない**（本物を消さないため）。
 */
async function collect(table, nameColumn, savedIds, legacyPattern) {
  const byId = savedIds?.length
    ? await must(admin.from(table).select(`id, ${nameColumn}`).in("id", savedIds), `${table}(id)`)
    : [];
  const byLegacy = await must(admin.from(table).select(`id, ${nameColumn}`).like(nameColumn, legacyPattern), `${table}(印)`);
  const map = new Map();
  for (const row of [...byId, ...byLegacy]) map.set(row.id, row);
  return [...map.values()];
}

async function main() {
  console.log(apply ? "【消します】" : "【見るだけ】（--apply を付けると消します）\n");

  // 1. ダミーユーザー（email で見分ける。画面に出ない値なので印をやめても使える）
  const dummies = await must(admin.from("users").select("id, email, display_name").like("email", `seed-%@${SEED_EMAIL_DOMAIN}`), "users");
  console.log(`ダミーユーザー: ${dummies.length} 人${dummies.length ? `（${dummies.map((u) => u.display_name).join("・")}）` : ""}`);

  // 2. 旅行（seed）
  const trips = await collect("trips", "title", SAVED.tripIds, `${LEGACY_SEED_TAG}%`);
  const tripIds = trips.map((t) => t.id);
  console.log(`旅行（アルバム）: ${tripIds.length} 件${tripIds.length ? `（${trips.map((t) => t.title).join("・")}）` : ""}`);

  // 3. スポット（seed）
  const spots = await collect("spots", "name", SAVED.spotIds, `%${LEGACY_SEED_SPOT_SUFFIX}`);
  const spotIds = spots.map((s) => s.id);
  console.log(`スポット: ${spotIds.length} 件`);
  if (spotIds.length) {
    // head: true のときは data ではなく count に入る（must は data を返すので、ここだけ直接受ける）
    const { count, error } = await admin.from("posts").select("id", { count: "exact", head: true }).in("spot_id", spotIds);
    if (error) throw new Error(`posts(left): ${error.message}`);
    console.log(`  （このスポットに紐づく投稿: ${count ?? "?"} 件。seed 以外の投稿が残っていると消せません）`);
  }

  if (!apply) {
    console.log("\n消していません。--apply を付けると消します");
    return;
  }

  for (const u of dummies) {
    const { error } = await admin.auth.admin.deleteUser(u.id);
    if (error) throw new Error(`auth.deleteUser(${u.email}): ${error.message}`);
  }
  console.log(`\nダミーユーザー: ${dummies.length} 人を削除`);

  if (tripIds.length) {
    // 自分の投稿（seed の旅行に紐づく）を先に消す（spots が restrict のため posts を残せない）
    const posts = await must(admin.from("posts").delete().in("trip_id", tripIds).select("id"), "posts");
    console.log(`seed の旅行に紐づく投稿: ${posts.length} 件を削除`);
    await must(admin.from("trips").delete().in("id", tripIds), "trips(delete)");
  }
  console.log(`旅行（アルバム・しおり）: ${tripIds.length} 件を削除`);

  if (spotIds.length) {
    const left = await must(admin.from("posts").select("id", { count: "exact", head: true }).in("spot_id", spotIds), "posts(left)");
    await must(admin.from("wishlist").delete().in("spot_id", spotIds), "wishlist");
    await must(admin.from("spot_status_reports").delete().in("spot_id", spotIds), "spot_status_reports");
    await must(admin.from("itinerary_spots").delete().in("spot_id", spotIds), "itinerary_spots");
    const { error } = await admin.from("spots").delete().in("id", spotIds);
    if (error) throw new Error(`spots(delete): ${error.message}（seed のスポットに seed 以外の投稿が残っているかもしれません: ${left ?? "?"} 件）`);
  }
  console.log(`スポット: ${spotIds.length} 件を削除`);

  // 4. 宙に浮いた通知（related_id の先が無いもの）は、seed で入れた分だけ消す
  const notifs = await must(admin.from("notifications").select("id, type, related_id"), "notifications");
  const dangling = [];
  for (const n of notifs) {
    const table = n.type === "comment" || n.type === "like" ? "posts" : n.type.startsWith("itinerary") ? "itineraries" : n.type === "album_join" ? "trips" : null;
    if (!table || !n.related_id) continue;
    const row = await must(admin.from(table).select("id").eq("id", n.related_id).maybeSingle(), `notifications(${table})`);
    if (!row) dangling.push(n.id);
  }
  if (dangling.length) await must(admin.from("notifications").delete().in("id", dangling), "notifications(delete)");
  console.log(`宙に浮いた通知: ${dangling.length} 件を削除`);

  // 5. Storage に入れた seed の写真を消す（#703）。
  //    投稿が消えても Storage のファイルは残るので、ここで片付ける
  const { data: files } = await admin.storage.from("post-media").list("seed");
  const paths = (files ?? []).map((file) => `seed/${file.name}`);
  if (paths.length) {
    const { error } = await admin.storage.from("post-media").remove(paths);
    if (error) throw new Error(`storage(seed): ${error.message}`);
  }
  console.log(`seed の写真: ${paths.length} 枚を削除`);

  console.log("\n完了。");
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
