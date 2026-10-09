// 管理者が認証アプリ（二段階確認）を失ったときに、登録を消してやり直せるようにする。
//
// 使い方:  node scripts/admin-mfa-reset.mjs <メールアドレス>
//
// 出典: docs/tasks/admin/admin-login/08-mfa-recovery.md
//       要件定義書 3.10.1「認証アプリを失ったとき」
//
// 【初心者向け】なぜ画面に「認証アプリを解除する」ボタンを作らないのか。
// そこが二段階確認の抜け道になるから。アカウントを乗っ取った人は、まず二段階確認を外そうとする。
// 画面に解除の導線があれば、Google アカウントを破った時点で二段階確認も外せてしまい、
// わざわざ足した意味が無くなる。だから復旧の道は「サービスキーを持つ開発者の手元」だけにする。
//
// この操作は画面を通らないので、操作の記録（admin_actions）には残らない。
// 誰のを・いつ消したかは別に残すこと（要件 3.10.1 の運用手順と同じ扱い）。
import { connect } from "./supabase-target.mjs";
import { createInterface } from "node:readline/promises";
import { formatFactorLine, isConfirmed, nothingToDeleteMessage, parseArgs } from "./admin-mfa-reset.lib.mjs";

const parsed = parseArgs(process.argv.slice(2));
if (!parsed.ok) {
  console.error(parsed.message);
  process.exit(1);
}
const { email } = parsed;

// .env.local から読む。値は画面にも変数名以外の形でも出さない（AGENTS.md 21）
const { admin } = await connect();

// ① メールアドレスから利用者を引く
const { data: user, error: userError } = await admin
  .from("users")
  .select("id, email, display_name, is_admin")
  .eq("email", email)
  .maybeSingle();
if (userError) {
  console.error(`利用者を引けませんでした: ${userError.message}`);
  process.exit(1);
}
if (!user) {
  console.error(`${email} の利用者が見つかりません`);
  process.exit(1);
}
console.log(`対象: ${user.display_name}（${user.email}）${user.is_admin ? " / 管理者" : " / 管理者ではありません"}`);

// ② 持っている factor を出す。secret は出さない
const { data: factors, error: listError } = await admin.auth.admin.mfa.listFactors({ userId: user.id });
if (listError) {
  console.error(`認証アプリの登録を読めませんでした: ${listError.message}`);
  process.exit(1);
}
const list = factors?.factors ?? [];
if (list.length === 0) {
  console.log(nothingToDeleteMessage(email));
  process.exit(0);
}
console.log("消す対象（id / 種類 / 名前 / 状態 / 登録日時）:");
for (const factor of list) console.log(formatFactorLine(factor));

// ③ 確認してから消す
const rl = createInterface({ input: process.stdin, output: process.stdout });
const answer = await rl.question(`本当に ${list.length} 件すべて消しますか？ 消すなら yes と入れてください: `);
rl.close();
if (!isConfirmed(answer)) {
  console.log("何もしませんでした");
  process.exit(0);
}

for (const factor of list) {
  const { error } = await admin.auth.admin.mfa.deleteFactor({ id: factor.id, userId: user.id });
  if (error) {
    console.error(`${factor.id} を消せませんでした: ${error.message}`);
    process.exit(1);
  }
}

// ④ 何をしたかを出す（別途どこかに控えること）
console.log(`${new Date().toISOString()} ${email} の認証アプリの登録 ${list.length} 件を消しました`);
console.log("この人が次に /admin を開くと、二段階確認の登録（SC-32）からやり直せます");
console.log("※ この操作は画面を通らないため操作の記録には残りません。日時と対象を別に控えてください");
