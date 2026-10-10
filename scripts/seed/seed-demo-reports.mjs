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
 * 背景として並べる通報。**jev_* は 2026-10-11 の実測値**。
 * `reason` は通報した人が選んだもの、`jev.reason` は Jev が見立てたもの。
 */
const BACKGROUND = [
  {
    reason: "other",
    detail: "写真に通りすがりの人の顔が写っています",
    jev: { urgency: 2.23, reason: "copyright", confidence: 0.75 },
  },
  {
    reason: "inappropriate",
    detail: "まずかったと書いてあるのが気に入りません",
    jev: { urgency: 0.28, reason: "other", confidence: 0.75 },
  },
];

const say = (line) => console.log(line);

/**
 * その通報の通報者を選ぶ。投稿した本人は選ばず、**通報ごとに別の人**にする
 * （同じ人が並ぶと「異なる通報者 N 人」の話が伝わらないため）。
 */
function pickReporter(post, index) {
  const candidates = users.filter((u) => u.id !== post.user_id && !u.is_admin);
  return candidates[index % candidates.length];
}

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
/** 背景の通報がぶら下がる投稿。通報される投稿とは別にする */
const others = posts.slice(1, 1 + BACKGROUND.length);

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
for (const [i, item] of BACKGROUND.entries()) {
  const post = others[i];
  const reporter = pickReporter(post, i);
  say(`   - ${reporter.display_name} →「${item.detail}」（緊急度 ${item.jev.urgency}）`);
}

if (!apply) {
  say("");
  say("見ただけで何も書いていません。実際に書くには --apply を付けてください。");
  process.exit(0);
}

const updated = await admin.from("posts").update({ comment: DEMO_COMMENT }).eq("id", target.id);
if (updated.error) throw new Error(`感想を直せません: ${updated.error.message}`);

let written = 0;
for (const [i, item] of BACKGROUND.entries()) {
  const post = others[i];
  const reporter = pickReporter(post, i);
  const row = {
    reporter_id: reporter.id,
    target_type: "post_review",
    target_id: post.id,
    reason: item.reason,
    detail: item.detail,
    status: "unconfirmed",
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
