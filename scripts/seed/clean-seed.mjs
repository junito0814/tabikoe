// seed-tokyo.mjs が入れたダミーデータを全部消す。
//
// 使い方:  node scripts/seed/clean-seed.mjs
//
// 【初心者向け】消す順番と理由:
//   1. ダミーユーザー（email が seed-*@example.invalid）を auth から削除 → users は cascade で消え、
//      その人の投稿・写真・コメント・いいね・行きたい・アルバム参加・しおり参加も cascade で消える
//   2. 旅行（title が「[seed] 」始まり）を削除 → 自分のしおり・しおりのスポット・メンバー・自分の投稿（seed の旅行に紐づくもの）・下書きが消える
//   3. スポット（name が「（seed）」終わり）を削除 → まだあった報告・行きたい が消える
//      （投稿は spot_id が on delete restrict なので、先に 1・2 で投稿を消してから）
//   4. 自分宛の通知のうち related_id が消えたものを削除
//   あなたの seed 以外のデータ（自分で作った投稿・旅行・行きたい）には触らない。
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

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

const SEED_TAG = "[seed] ";
const SEED_SPOT_SUFFIX = "（seed）";
const SEED_EMAIL_DOMAIN = "example.invalid";

async function must(promise, label) {
  const { data, error } = await promise;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

async function main() {
  // 1. ダミーユーザー
  const dummies = await must(admin.from("users").select("id, email").like("email", `seed-%@${SEED_EMAIL_DOMAIN}`), "users");
  for (const u of dummies) {
    const { error } = await admin.auth.admin.deleteUser(u.id);
    if (error) throw new Error(`auth.deleteUser(${u.email}): ${error.message}`);
  }
  console.log(`ダミーユーザー: ${dummies.length} 人を削除`);

  // 2. 旅行（seed）
  const trips = await must(admin.from("trips").select("id").like("title", `${SEED_TAG}%`), "trips");
  const tripIds = trips.map((t) => t.id);
  if (tripIds.length) {
    // 自分の投稿（seed の旅行に紐づく）を先に消す（spots が restrict のため posts を残せない）
    const posts = await must(admin.from("posts").delete().in("trip_id", tripIds).select("id"), "posts");
    console.log(`seed の旅行に紐づく投稿: ${posts.length} 件を削除`);
    await must(admin.from("trips").delete().in("id", tripIds), "trips(delete)");
  }
  console.log(`旅行（アルバム・しおり）: ${tripIds.length} 件を削除`);

  // 3. スポット（seed）
  const spots = await must(admin.from("spots").select("id").like("name", `%${SEED_SPOT_SUFFIX}`), "spots");
  const spotIds = spots.map((s) => s.id);
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

  console.log("\n完了。");
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
