// #896: 開発用の Supabase が本番と同じ形になっているか突き合わせる。
//
// 使い方:  node scripts/compare-projects.mjs
//   .env.local の以下を読む（値は画面に出さない）
//     本番: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY
//     開発: DEV_SUPABASE_URL / DEV_SUPABASE_SECRET_KEY
//
// 【初心者向け】何を見ているか。
//   「マイグレーションを流したつもり」が本当に効いているかは、**向こうに聞いてみないと分からない**。
//   とくにこのプロジェクトは既定の権限を外してあるので（20260908000008）、
//   **表は出来ているのに誰も読み書きできない**という状態が起こりうる。しかも画面には出ない
//   （数えられなかったときは 0 件として黙る作りのため）。実際 #754 で起きた。
//   だから「表があるか」ではなく「**service_role で実際に読めるか**」を確かめる。
import { createClient } from "@supabase/supabase-js";
import { readdirSync, readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^"|"$/g, "")];
    })
);

function need(...names) {
  for (const name of names) {
    if (!env[name]) throw new Error(`.env.local に ${name} がありません`);
  }
}
need("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY", "DEV_SUPABASE_URL", "DEV_SUPABASE_SECRET_KEY");

const options = { auth: { autoRefreshToken: false, persistSession: false } };
const prod = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, options);
const dev = createClient(env.DEV_SUPABASE_URL, env.DEV_SUPABASE_SECRET_KEY, options);

if (env.NEXT_PUBLIC_SUPABASE_URL === env.DEV_SUPABASE_URL) {
  throw new Error("本番と開発が同じプロジェクトを指しています。分ける意味がありません");
}

/** マイグレーションが作る public の表 */
const DIR = "supabase/migrations";
const sql = readdirSync(DIR)
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((name) => readFileSync(`${DIR}/${name}`, "utf8"))
  .join("\n");
const tables = [...new Set([...sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.(\w+)/gi)].map((m) => m[1]))].sort();

/** その表を service_role で読めるか。読めれば件数も返す */
async function probe(client, table) {
  const { count, error } = await client.from(table).select("*", { head: true, count: "exact" });
  return error ? { ok: false, reason: error.message } : { ok: true, count: count ?? 0 };
}

console.log(`マイグレーションが作る表: ${tables.length} 個\n`);
console.log("表".padEnd(26) + "本番".padStart(10) + "開発".padStart(10));
console.log("-".repeat(46));

const problems = [];
for (const table of tables) {
  const [p, d] = await Promise.all([probe(prod, table), probe(dev, table)]);
  const show = (r) => (r.ok ? `${r.count} 件` : "読めない");
  console.log(table.padEnd(26) + show(p).padStart(10) + show(d).padStart(10));
  if (!d.ok) problems.push(`${table}: 開発で読めない（${d.reason}）`);
  if (!p.ok) problems.push(`${table}: 本番で読めない（${p.reason}）`);
}

console.log("\n--- Storage のバケット ---");
const [pb, db] = await Promise.all([prod.storage.listBuckets(), dev.storage.listBuckets()]);
const describe = (b) => `public=${b.public} 上限=${b.file_size_limit ?? "既定"} 形式=${b.allowed_mime_types?.join(",") ?? "制限なし"}`;
const devByName = new Map((db.data ?? []).map((b) => [b.name, b]));
for (const bucket of pb.data ?? []) {
  const mine = devByName.get(bucket.name);
  if (!mine) {
    problems.push(`バケット ${bucket.name} が開発に無い`);
    console.log(`  ${bucket.name}: 開発に無い ← NG`);
    continue;
  }
  const same = describe(bucket) === describe(mine);
  console.log(`  ${bucket.name.padEnd(12)} ${same ? "一致" : "違う"}`);
  if (!same) {
    problems.push(`バケット ${bucket.name} の設定が違う`);
    console.log(`      本番: ${describe(bucket)}`);
    console.log(`      開発: ${describe(mine)}`);
  }
}

console.log("");
if (problems.length === 0) {
  console.log("開発用の Supabase は本番と同じ形です ← OK");
} else {
  console.log("直すところ:");
  for (const p of problems) console.log("  - " + p);
  process.exitCode = 1;
}
