// #896: 管理者の印（users.is_admin）を付け外しする。
//
// 使い方:
//   node scripts/grant-admin.mjs you@example.com            … 見るだけ（変えない）
//   node scripts/grant-admin.mjs you@example.com --apply    … 開発用で管理者にする
//   node scripts/grant-admin.mjs you@example.com --apply --revoke       … 管理者を外す
//   node scripts/grant-admin.mjs you@example.com --apply --production   … ★ 本番
//
// 【初心者向け】なぜスクリプトにするのか。
//   管理者の印は**画面からは付けられません**（要件 3.10.1。付けられると、そこが穴になるため）。
//   これまでは Supabase の SQL エディタで手作業していましたが、開発用のプロジェクトを
//   作り直すたびに同じことをするので、手順を残せる形にしました。
//
//   **印を付けただけでは管理画面に入れません。** そのあと /admin を開くと認証アプリ（TOTP）の
//   登録画面へ誘導されます。6 桁まで通して初めて入れます（src/lib/admin/mfa-gate.ts）。
//
//   この操作は画面を通らないので**操作の記録（3.10.12）に残りません**。
//   誰にいつ付けたかは別に控えてください（docs/deployment.md と同じ扱い）。
import { connect } from "./supabase-target.mjs";

const { admin, target } = await connect();

const apply = process.argv.includes("--apply");
const revoke = process.argv.includes("--revoke");
/** メールアドレスは「- で始まらない最初の引数」。複数人を巻き込まないよう 1 つだけ受ける */
const email = process.argv.slice(2).find((arg) => !arg.startsWith("-"));

if (!email) {
  console.error("メールアドレスを 1 つ渡してください。例: node scripts/grant-admin.mjs you@example.com --apply");
  process.exit(1);
}

const { data: user, error } = await admin
  .from("users")
  .select("id, display_name, email, is_admin, is_deleted")
  .eq("email", email)
  .maybeSingle();

if (error) throw new Error(`users を読めませんでした: ${error.message}`);
if (!user) {
  console.error(`${target.label}に ${email} が居ません。一度ログインしてから実行してください`);
  process.exit(1);
}

const want = !revoke;
console.log(`  ${user.display_name ?? "(名前なし)"}  ${email}`);
console.log(`  いまの管理者の印: ${user.is_admin ? "あり" : "なし"} → ${want ? "あり" : "なし"}`);
if (user.is_deleted) console.log("  ※ 退会済みの利用者です");

if (user.is_admin === want) {
  console.log("\n既にその状態です。何もしません。");
  process.exit(0);
}

if (!apply) {
  console.log("\n（見ただけ。実際に変えるには --apply を付けます）");
  process.exit(0);
}

const { error: updateError } = await admin.from("users").update({ is_admin: want }).eq("id", user.id);
if (updateError) throw new Error(`更新できませんでした: ${updateError.message}`);

console.log(`\n${want ? "管理者にしました" : "管理者を外しました"}（${target.label}）`);
if (want) {
  console.log("次にやること: /admin を開くと認証アプリ（TOTP）の登録画面が出ます。");
  console.log("  6 桁まで通すと管理画面に入れます。印だけでは入れません。");
}
