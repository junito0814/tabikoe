// 2026-10-14 のプレゼン（GGA セレクション）のデモ③ 用のデータを仕込む。
//
// 使い方:
//   node scripts/seed/seed-demo-reports.mjs          … 何をするか見るだけ（書かない）
//   node scripts/seed/seed-demo-reports.mjs --apply  … 実際に書く
//   （既定は開発用の Supabase。本番には当てない。--production は付けないこと）
//
// 【初心者向け】デモで何を見せるか。
//   ①②（記録する・共有する）はもう見せられる。③ は「変な投稿を見つけて通報し、
//   管理者が管理画面で対処する」。そのために要るのは 2 つだけ:
//     a. **通報される投稿**  … 電話番号が書かれた感想。これをデモ中に通報する
//     b. **背景として並ぶ通報** … 一覧が 1 件だけだと「緊急度が高い順」が伝わらない
//
//   a の通報は**デモ中に本当に作る**。そこで Jev が本当に呼ばれ、
//   管理画面に緊急度が付いて出てくる。そこが見せ場なので、先に仕込まない。
//
// 【初心者向け】b に入れている Jev の値は作り物ではない。
//   2026-10-11 に、同じ文章を**実際に Jev へ送って返ってきた値**を書いてある
//   （モデル jev-1.13.0、195〜477 ms）。プロンプトを 2 か所に書かない（約束 14）ために、
//   このスクリプトからは Jev を呼ばず、測った値をそのまま入れている。
//
// 片付け: 通報は reporter_id が利用者を on delete cascade で参照しているので、
//   `node scripts/seed/clean-seed.mjs --apply` でダミー利用者を消せば一緒に消える。
import { connect } from "../supabase-target.mjs";
import { SEED_EMAIL_DOMAIN } from "./seed-data.mjs";

const apply = process.argv.includes("--apply");
const { admin } = await connect(process.argv);

/** デモで通報する感想。電話番号が入っている（要件 3.8.1 の「個人情報の掲載」） */
const DEMO_COMMENT =
  "思っていたより空いていて、ゆっくり見られた。予約もできるそうで、担当の田中さんの携帯 090-1234-5678 に直接かければ空いている時間を教えてくれます。";

/**
 * 背景として並べる通報。**jev_* は 2026-10-11 の実測値**（モデル jev-1.13.0、142〜652ms）。
 *
 * `reason` は通報した人が選んだもの、`jev.reason` は Jev が見立てたもの。
 * **わざと 3 通りの見え方を混ぜてあります**（画面の作りを一度で見せられるように）:
 *   a. 一致      … 見立てを薄い字で出す（ただの重複なので目立たせない）
 *   b. 食い違い  … 見立てを濃い字で出す（ここがいちばん値打ちのあるところ）
 *   c. 「―」     … 「その他」と見立てたとき、または確信が 0.7 を下回ったとき
 *
 * `daysAgo` は何日前の通報にするか。**緊急度が低いものほど古く放置されている形**にしてあります
 *   ── 一覧の帯「最も古い未対応は N 日前です」は **1 日以上でしか出ない**ので、
 *   全部を今日の日付にすると、あの帯が出ません（デモで見せられなくなる）。
 * `status` を書いたものは「確認中」。**状態の列が全部同じだと、動いている画面に見えません。**
 */
const BACKGROUND = [
  /*
   * a. 一致・いちばん重い
   *
   * ~~{ personal_info「投稿に、お店の人の住所と本名が書かれています」urgency 2.98 }~~
   * → **2026-10-11 に外した。** デモの撮影では、その場で「電話番号が書かれています」と通報する。
   *   実測でそれは **2.79** なので、2.98 の行が残っていると**作った通報が 2 番目**に来てしまい、
   *   台本の「電話番号が書かれた投稿が、いちばん上に来ています」が嘘になる。
   */
  /*
   * ~~{ impersonation 2.37 }~~ ／ ~~{ other → copyright 2.23 }~~
   * → **2026-10-12 に外した。** デモの撮影ではその場で通報し、Jev がその場で点を付ける。
   *   実測すると **2.23〜2.79** と毎回ぶれるので、2.37 の行があると 2 番目に落ちることがある。
   *   台本は「先ほど通報した投稿が、いちばん上に来ています」と言い切るので、
   *   **背景の最大を 1.98 まで下げて、どう転んでも 1 位になる**ようにした。
   */
  // b. 食い違い（通報者は「その他」、Jev は「著作権・肖像権の侵害」）
  { targetType: "post_photo", reason: "other", detail: "写真に通りすがりの人の顔が写っています",
    jev: { urgency: 1.93, reason: "copyright", confidence: 0.75 }, daysAgo: 1 },
  { targetType: "post_photo", reason: "copyright", detail: "他のサイトに載っている写真を、そのまま使っています",
    jev: { urgency: 1.98, reason: "copyright", confidence: 1 }, daysAgo: 1 },
  { targetType: "post_review", reason: "spam", detail: "同じ宣伝のコメントを、いくつもの投稿に貼っています",
    jev: { urgency: 1.68, reason: "spam", confidence: 1 }, daysAgo: 2, status: "in_review" },
  { targetType: "post_review", reason: "inappropriate", detail: "コメントで他の利用者を馬鹿にする書き方をしています",
    jev: { urgency: 1.67, reason: "inappropriate", confidence: 1 }, daysAgo: 3 },
  /*
   * c. **確信が足りないので「―」になる**（0.65 < 0.7）。
   *   通報者は「事実と異なる」を選んだが、Jev は「場所の情報の誤り」と見立てた。
   *   食い違っているのに自信が無いので、**画面には出しません**。ここを見せたくて入れてあります。
   */
  { targetType: "post_review", reason: "false_info", detail: "このお店はもう閉店しているのに、営業していると書かれています",
    jev: { urgency: 1.65, reason: "wrong_spot_info", confidence: 0.65 }, daysAgo: 4 },
  { targetType: "post_review", reason: "wrong_spot_info", detail: "住所が隣の町になっています",
    jev: { urgency: 1.15, reason: "wrong_spot_info", confidence: 0.99 }, daysAgo: 5, status: "in_review" },
  // c. **「その他」なので「―」**（運営者が次にすることが何も変わらないため）
  { targetType: "post_review", reason: "other", detail: "写真が暗くて、何が写っているのか分かりません",
    jev: { urgency: 0.88, reason: "other", confidence: 1 }, daysAgo: 6 },
  { targetType: "post_review", reason: "inappropriate", detail: "まずかったと書いてあるのが気に入りません",
    jev: { urgency: 0.28, reason: "other", confidence: 0.75 }, daysAgo: 6 },
];

const say = (line) => console.log(line);


/** jev_* の列が当たっているか。当たっていなければ緊急度は入れられない */
async function jevColumnsExist() {
  const { error } = await admin.from("reports").select("jev_urgency").limit(1);
  return !error;
}

const { data: users, error: usersError } = await admin
  .from("users")
  .select("id, display_name, email, is_admin")
  .like("email", `%@${SEED_EMAIL_DOMAIN}`);
if (usersError) throw new Error(`利用者を読めません: ${usersError.message}`);
if (users.length < 3) {
  throw new Error(
    `ダミー利用者が ${users.length} 人しかいません。先に node scripts/seed/seed-tokyo.mjs --apply を実行してください`
  );
}

const { data: posts, error: postsError } = await admin
  .from("posts")
  .select("id, user_id, comment, spot_id")
  .eq("status", "published")
  .eq("visibility", "public")
  .in("user_id", users.map((u) => u.id))
  .order("created_at", { ascending: true });
if (postsError) throw new Error(`投稿を読めません: ${postsError.message}`);
if (posts.length < 3) throw new Error(`公開されたダミー投稿が ${posts.length} 件しかありません`);

/** 通報される投稿（いちばん古いもの。デモの順番が毎回変わらないように） */
const target = posts[0];
/*
 * 背景の通報の宛先を 1 件ずつ作る。
 *
 * 【初心者向け】なぜ 1 件ずつ別の宛先にするのか。
 *   `reports` には「**同じ人が同じ対象に 2 回は通報できない**」という制約があります
 *   （reports_reporter_target_unique）。宛先を使い回すと、2 件目から入りません。
 *   ダミー投稿は 40 件以上あるので、1 件ずつ別の投稿にします。
 *
 * 写真への通報（`post_photo`）は、投稿ではなく**写真の id** を指します。
 */
const rest = posts.slice(1);
const { data: photos } = await admin
  .from("post_photos")
  .select("id, post_id")
  .in("post_id", rest.map((p) => p.id))
  .order("post_id", { ascending: true });

let photoCursor = 0;
let postCursor = 0;
/** その通報の宛先（種別・id・その対象の持ち主） */
function nextTarget(targetType) {
  if (targetType === "post_photo") {
    const photo = photos?.[photoCursor++];
    if (!photo) throw new Error("写真が足りません。先に seed-tokyo.mjs を実行してください");
    const post = rest.find((p) => p.id === photo.post_id);
    return { targetType, targetId: photo.id, ownerId: post?.user_id ?? null, label: `写真 ${photo.id.slice(0, 8)}` };
  }
  const post = rest[postCursor++];
  if (!post) throw new Error("公開されたダミー投稿が足りません");
  return { targetType, targetId: post.id, ownerId: post.user_id, label: `感想 ${post.id.slice(0, 8)}` };
}

/** 宛先と通報者を先に全部決めておく（見るだけのときと、書くときで同じ割り当てにする） */
const plan = BACKGROUND.map((item, index) => {
  const target = nextTarget(item.targetType);
  const candidates = users.filter((u) => u.id !== target.ownerId && !u.is_admin);
  return { item, target, reporter: candidates[index % candidates.length] };
});

const owner = users.find((u) => u.id === target.user_id);
say("");
say(`① 通報される感想（${owner?.display_name} の投稿 ${target.id.slice(0, 8)}）に電話番号を入れる`);
say(`   いま: ${target.comment.slice(0, 40)}…`);
say(`   あと: ${DEMO_COMMENT.slice(0, 40)}…`);

const hasJev = await jevColumnsExist();
say("");
say(`② 背景として並ぶ通報を ${BACKGROUND.length} 件入れる（緊急度 ${hasJev ? "入れる" : "**入れられない**"}）`);
if (!hasJev) {
  say("   ⚠ reports に jev_* の列がありません。");
  say("     supabase/migrations/20261011000001_reports_jev_triage.sql を");
  say("     Supabase の SQL Editor に貼って実行してから、もう一度このスクリプトを走らせてください。");
}
for (const { item, target, reporter } of plan) {
  const shown = item.jev.reason === "other" || item.jev.confidence < 0.7 ? "―" : item.jev.reason;
  say(`   ${String(item.jev.urgency).padStart(5)}  ${String(item.daysAgo ?? 0)} 日前  ${(item.status ?? "unconfirmed") === "in_review" ? "確認中" : "未確認"}  ${reporter.display_name.padEnd(4)} → ${target.label}  見立て ${shown.padEnd(16)}「${item.detail.slice(0, 18)}」`);
}

/*
 * 【初心者向け】入れる前に、**前にこのスクリプトが入れたぶんを消します**。
 *   消さないと、宛先の割り当てが変わったときに**古い行が残って重複します**
 *   （実際に 2026-10-11 に 9 件のつもりが 13 件になりました）。
 *   見分け方は「**ダミー利用者が出した通報**」── あなた自身が画面から出した通報は消しません。
 */
const dummyIds = users.filter((u) => !u.is_admin).map((u) => u.id);
const { count: stale } = await admin
  .from("reports")
  .select("*", { head: true, count: "exact" })
  .in("reporter_id", dummyIds);
say("");
say(`③ 前に入れたぶんを消す（ダミー利用者の通報 ${stale ?? 0} 件）。あなたが画面から出した通報は消しません`);

if (!apply) {
  say("");
  say("見ただけで何も書いていません。実際に書くには --apply を付けてください。");
  process.exit(0);
}

const cleared = await admin.from("reports").delete().in("reporter_id", dummyIds);
if (cleared.error) throw new Error(`前のぶんを消せません: ${cleared.error.message}`);

const updated = await admin.from("posts").update({ comment: DEMO_COMMENT }).eq("id", target.id);
if (updated.error) throw new Error(`感想を直せません: ${updated.error.message}`);

let written = 0;
for (const { item, target, reporter } of plan) {
  const row = {
    reporter_id: reporter.id,
    target_type: target.targetType,
    target_id: target.targetId,
    reason: item.reason,
    detail: item.detail,
    status: item.status ?? "unconfirmed",
    // 何日前の通報にするか（既定の now() に任せず、明示する）
    created_at: new Date(Date.now() - (item.daysAgo ?? 0) * 86_400_000 - 3 * 3_600_000).toISOString(),
  };
  if (hasJev) {
    Object.assign(row, {
      jev_urgency: item.jev.urgency,
      jev_reason: item.jev.reason,
      jev_confidence: item.jev.confidence,
      jev_model: "jev-1.13.0",
      jev_evaluated_at: new Date().toISOString(),
    });
  }
  // 同じ人が同じ対象に 2 回は通報できない（reports_reporter_target_unique）ので、上書きにする
  const { error } = await admin
    .from("reports")
    .upsert(row, { onConflict: "reporter_id,target_type,target_id" });
  if (error) throw new Error(`通報を入れられません: ${error.message}`);
  written += 1;
}

say("");
say(`入れました。感想 1 件を直し、通報 ${written} 件を入れました。`);
say("デモでは、この投稿を利用者として通報してください（そこで Jev が本当に呼ばれます）。");
say("片付け: node scripts/seed/clean-seed.mjs --apply");

/*
 * ================================================================
 * デモ①② 用の仕込み（2026-10-11 に追加）
 * ================================================================
 *
 * 【初心者向け】なぜ要るのか。
 *   動画② は「しおりに入れる → Day で振り分ける」を見せます。ところが
 *   **管理者のしおりが 0 件**だったので、入れる先がありませんでした（画面で作ると 10 秒かかる）。
 *   動画① は「スポットごとに、行った人の声が**集まっています**」と言いますが、
 *   1 スポットの投稿が**最大 2 件**しかなく、「集まっている」に見えませんでした。
 */

/** 動画② 用。管理者のアルバムに、しおりを 1 つ用意する（未定のスポットを 3 つ入れておく） */
async function seedItinerary() {
  const { data: me } = await admin.from("users").select("id, display_name").eq("is_admin", true).maybeSingle();
  if (!me) return say("   管理者が見つかりません（しおりは作りません）");

  const { data: trip } = await admin.from("trips").select("id, title").eq("user_id", me.id).eq("is_daily", false).limit(1).maybeSingle();
  if (!trip) return say("   管理者のアルバムがありません（しおりは作りません）");

  // しおりは 1 つのアルバムに 1 つだけ（itineraries_trip_unique）
  const { data: exists } = await admin.from("itineraries").select("id").eq("trip_id", trip.id).maybeSingle();
  let itineraryId = exists?.id ?? null;
  if (!itineraryId) {
    const start = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
    const end = new Date(Date.now() + 16 * 86_400_000).toISOString().slice(0, 10);
    const { data, error } = await admin.from("itineraries").insert({ trip_id: trip.id, start_date: start, end_date: end }).select("id").single();
    if (error) throw new Error(`しおりを作れません: ${error.message}`);
    itineraryId = data.id;
  }

  /*
   * 未定（day_index = null）のスポットを入れておく。
   * 撮影では、ここに 1 つ足してから Day 1・Day 2 に振り分けます。
   */
  const { data: spots } = await admin
    .from("spots")
    .select("id, name")
    .eq("prefecture", "東京都")
    .in("name", ["浅草寺", "東京スカイツリー", "浜離宮恩賜庭園"]);
  for (const [i, spot] of (spots ?? []).entries()) {
    await admin.from("itinerary_spots").upsert(
      { itinerary_id: itineraryId, spot_id: spot.id, day_index: null, sort_order: i },
      { onConflict: "itinerary_id,spot_id" }
    );
  }
  say(`   しおり「${trip.title}」に未定のスポット ${spots?.length ?? 0} 件（${(spots ?? []).map((s) => s.name).join("・")}）`);
}

/** 動画① 用。1 つのスポットに投稿を増やし、「声が集まっている」ように見せる */
async function seedCrowdedSpot() {
  const SPOT = "築地場外市場";
  const { data: spot } = await admin.from("spots").select("id").eq("name", SPOT).maybeSingle();
  if (!spot) return say(`   ${SPOT} がありません（投稿は増やしません）`);

  const { data: already } = await admin.from("posts").select("id").eq("spot_id", spot.id).eq("status", "published");
  const have = already?.length ?? 0;

  /** 足す投稿。**感想は全部ちがう文**にする（使い回すと seed だとばれる） */
  const EXTRA = [
    { comment: "朝六時に着いたら、仕入れの人と観光客が半々だった。玉子焼きは焼きたてを立ったまま食べるのがいい。", rating: 5, cost: 1200, duration: "1時間以内" },
    { comment: "海鮮丼の店は十一時を過ぎると列になる。十時前なら待たずに座れた。味噌汁が付く店を選ぶといい。", rating: 4, cost: 3200, duration: "2時間以内" },
    { comment: "食べ歩きだけで二時間いた。串に刺した帆立と、出汁巻きが当たり。現金しか使えない店がまだ多い。", rating: 5, cost: 2400, duration: "2時間以内" },
  ];
  // 写真は既にある seed の画像を使い回す（別々の絵を選ぶ）
  const { data: photos } = await admin.from("post_photos").select("storage_url").eq("media_type", "photo").limit(40);
  const dummy = users.filter((u) => !u.is_admin);
  let added = 0;
  for (const [i, item] of EXTRA.entries()) {
    const user = dummy[i % dummy.length];
    const { data: trip } = await admin.from("trips").select("id").eq("user_id", user.id).limit(1).maybeSingle();
    if (!trip) continue;
    // 同じ人が同じスポットに二重に入らないように、感想の頭で見る
    const { data: dup } = await admin.from("posts").select("id").eq("spot_id", spot.id).eq("user_id", user.id).like("comment", `${item.comment.slice(0, 12)}%`).maybeSingle();
    if (dup) continue;
    const { data: post, error } = await admin
      .from("posts")
      .insert({
        user_id: user.id, trip_id: trip.id, spot_id: spot.id, category: "グルメ",
        visit_date: new Date(Date.now() - (i + 2) * 86_400_000).toISOString().slice(0, 10),
        duration: item.duration, cost: item.cost, rating: item.rating, comment: item.comment,
        visibility: "public", status: "published", lat: 35.6654, lng: 139.7707,
        published_at: new Date(Date.now() - (i + 2) * 86_400_000).toISOString(),
      })
      .select("id").single();
    if (error) throw new Error(`投稿を足せません: ${error.message}`);
    const url = photos?.[(i * 7) % (photos?.length ?? 1)]?.storage_url;
    if (url) await admin.from("post_photos").insert({ post_id: post.id, media_type: "photo", storage_url: url, display_order: 0 });
    added += 1;
  }
  say(`   ${SPOT} の投稿を ${have} 件 → ${have + added} 件に`);
}

say("");
say(apply ? "④ デモ①② の仕込み" : "④ デモ①② の仕込み（--apply で実行）");
if (apply) {
  await seedItinerary();
  await seedCrowdedSpot();
}
