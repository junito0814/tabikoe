// #893: 動作確認のときに作って、そのまま残っていた行を消す。
//
// 使い方:
//   node scripts/seed/clean-test-leftovers.mjs          … 何が消えるか見るだけ（消さない）
//   node scripts/seed/clean-test-leftovers.mjs --apply  … 実際に消す
//
// 【初心者向け】これは seed（ダミーデータ）を消す clean-seed.mjs とは別物。
//   あちらは「スクリプトが入れた行」を id の控えで消す。こちらは**手で画面を触って作ってしまった行**を
//   消すので、控えが無い。そこで **1 件ずつ名前で指定**し、消す前に必ず一覧を出す。
//   名前で消すのは本来危険（同じ名前の本物があるかもしれない）なので、
//   「zzzzzz」「whauk」のように**利用者が付けるはずのない名前だけ**を対象にしている。
//
// 消すもの（2026-10-07 に本人が確認したもの）:
//   1. スポット zzzzzz / whauk / G's bar … 入力の動作確認で作ったもの。紐づく投稿ごと消す
//   2. しおり（旅行）テスト / てすと / #757 確認用… … 確認用に作ったもの
//   3. 表示名が「[撮影] 絞り込み」の利用者の投稿 … 中身が「大阪城 その1」のような確認用。
//      **アカウントそのものは消さない**（本人のものなので）
//   4. 投稿が 1 件も無い、名前が重複したスポット … 同じ場所が 2 つ地図に出てしまうため、空のほうを消す
import { connect } from "../supabase-target.mjs";

const { admin } = await connect();
const apply = process.argv.includes("--apply");

/** 動作確認で作られたと分かっている名前。ここに無いものは消さない */
const JUNK_SPOT_NAMES = ["zzzzzz", "whauk", "G's bar"];
const JUNK_TRIP_TITLES = ["テスト", "てすと", "#757 確認用 沖縄本島ぐるっと一周 5 泊 6 日"];
const JUNK_USER_DISPLAY_NAME = "[撮影] 絞り込み";

async function must(promise, label) {
  const { data, error } = await promise;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

/** 投稿を消す（写真・コメント・いいねは外部キーの cascade で一緒に消える）。Storage の実体も消す */
async function deletePosts(postIds, label) {
  if (postIds.length === 0) return;
  const photos = await must(admin.from("post_photos").select("storage_url").in("post_id", postIds), `${label}/写真`);
  // seed/ 以下は clean-seed.mjs の持ち物なので触らない
  const paths = photos.map((p) => p.storage_url).filter((p) => p && !p.startsWith("seed/"));
  if (apply) {
    await must(admin.from("posts").delete().in("id", postIds), `${label}/投稿`);
    if (paths.length > 0) {
      const { error } = await admin.storage.from("post-media").remove(paths);
      if (error) console.warn(`  Storage を消せませんでした（行は消えています）: ${error.message}`);
    }
  }
  console.log(`  ${label}: 投稿 ${postIds.length} 件、Storage ${paths.length} 件`);
}

async function main() {
  console.log(apply ? "=== 消します（--apply）===" : "=== 見るだけ。消すには --apply ===");

  // 1. 動作確認で作ったスポット
  const junkSpots = await must(admin.from("spots").select("id, name, prefecture").in("name", JUNK_SPOT_NAMES), "spots");
  console.log(`\n1. 動作確認のスポット: ${junkSpots.length} 件`);
  for (const s of junkSpots) console.log(`  ${s.name}（${s.prefecture ?? "—"}）`);
  if (junkSpots.length > 0) {
    const ids = junkSpots.map((s) => s.id);
    const posts = await must(admin.from("posts").select("id").in("spot_id", ids), "posts(spot)");
    await deletePosts(posts.map((p) => p.id), "  紐づく投稿");
    if (apply) {
      // spots を消す前に、spot_id を見ている行を先に消す（外部キーが restrict のため）
      await must(admin.from("wishlist").delete().in("spot_id", ids), "wishlist");
      await must(admin.from("spot_status_reports").delete().in("spot_id", ids), "spot_status_reports");
      await must(admin.from("itinerary_spots").delete().in("spot_id", ids), "itinerary_spots");
      await must(admin.from("spots").delete().in("id", ids), "spots(delete)");
    }
  }

  // 2. 確認用のしおり（旅行）
  const junkTrips = await must(admin.from("trips").select("id, title").in("title", JUNK_TRIP_TITLES), "trips");
  console.log(`\n2. 確認用のしおり: ${junkTrips.length} 件`);
  for (const t of junkTrips) console.log(`  ${t.title}`);
  if (junkTrips.length > 0) {
    const ids = junkTrips.map((t) => t.id);
    const posts = await must(admin.from("posts").select("id").in("trip_id", ids), "posts(trip)");
    await deletePosts(posts.map((p) => p.id), "  紐づく投稿");
    if (apply) await must(admin.from("trips").delete().in("id", ids), "trips(delete)");
  }

  // 3. 作業用の表示名が付いた利用者の投稿（アカウントは残す）
  const u = await must(admin.from("users").select("id, display_name").eq("display_name", JUNK_USER_DISPLAY_NAME).maybeSingle(), "users");
  console.log(`\n3. 「${JUNK_USER_DISPLAY_NAME}」の投稿`);
  if (!u) {
    console.log("  その表示名の利用者は居ません");
  } else {
    const posts = await must(admin.from("posts").select("id, comment").eq("user_id", u.id), "posts(user)");
    for (const p of posts) console.log(`  ${JSON.stringify((p.comment ?? "").slice(0, 30))}`);
    await deletePosts(posts.map((p) => p.id), "  投稿");
  }

  // 4. 名前が重複していて、投稿が 1 件も無いスポット
  const allSpots = await must(admin.from("spots").select("id, name, prefecture"), "spots(all)");
  const allPosts = await must(admin.from("posts").select("spot_id"), "posts(all)");
  const hasPost = new Set(allPosts.map((p) => p.spot_id));
  const byName = new Map();
  for (const s of allSpots) byName.set(s.name, [...(byName.get(s.name) ?? []), s]);
  const emptyDupes = [];
  for (const [name, list] of byName) {
    if (list.length < 2) continue;
    const empty = list.filter((s) => !hasPost.has(s.id));
    // 全部空なら 1 件だけ残す。1 件でも投稿があるなら、空のほうを全部消す
    const toDelete = empty.length === list.length ? empty.slice(1) : empty;
    for (const s of toDelete) emptyDupes.push({ ...s, name });
  }
  console.log(`\n4. 重複していて投稿が無いスポット: ${emptyDupes.length} 件`);
  for (const s of emptyDupes) console.log(`  ${s.name}（${s.prefecture ?? "—"}）`);
  if (emptyDupes.length > 0 && apply) {
    const ids = emptyDupes.map((s) => s.id);
    await must(admin.from("wishlist").delete().in("spot_id", ids), "wishlist(dupe)");
    await must(admin.from("spot_status_reports").delete().in("spot_id", ids), "spot_status_reports(dupe)");
    await must(admin.from("itinerary_spots").delete().in("spot_id", ids), "itinerary_spots(dupe)");
    await must(admin.from("spots").delete().in("id", ids), "spots(dupe delete)");
  }

  console.log(apply ? "\n消しました。" : "\n（見ただけ。消すには --apply）");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
