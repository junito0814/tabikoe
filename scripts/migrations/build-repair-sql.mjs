#!/usr/bin/env node
/**
 * #944: 「この N 本はもう当たっている」と記録表に書き込む SQL を作る（~~52 本~~ → 本数はファイルから数える）。
 *
 * 【初心者向け】なぜこのスクリプトが要るのか。
 *
 * Supabase CLI（`supabase db push`）は、**どこまで当てたか**を DB の
 * `supabase_migrations.schema_migrations` という表で覚えています。
 * ところがこのプロジェクトは、ずっと **SQL エディタに貼って**当ててきたので、
 * **その表がそもそも作られていません**（2026-10-17 に開発用 DB で確認）。
 *
 * この状態で `supabase db push` を一度でも走らせると、**52 本すべてが最初から流れます**。
 * 既にある表を `create table` して途中で止まるか、`drop` を含むものがあれば**データが消えます**。
 *
 * そこで「この 52 本はもう当たっている」と先に書き込んで、**空振りする状態**を作ります。
 * 手で並べると必ず抜けるので、**ファイル名から機械で作ります**。
 *
 * 使い方:
 *   node scripts/migrations/build-repair-sql.mjs            # SQL を標準出力に出す
 *   node scripts/migrations/build-repair-sql.mjs --list      # 版だけ並べる（本数の確認用）
 *   node scripts/migrations/build-repair-sql.mjs --except 20261107000001   # 当たっていない版を除く（複数は , 区切り）
 *
 * **このスクリプトは DB に接続しません。** 出てきた SQL を、
 * 開発用 → 本番の順に SQL エディタへ貼って実行してください（当てる手順は docs/deployment.md）。
 *
 * #944（2026-11-17）: 2 つ直した。
 *
 * 1. **当たっていない版を除けるようにした（`--except`）。** 2026-11-14 に本番を調べると、
 *    53 本のうち 2 本が当たっていなかった（#1082）。全部を「当て済み」と書くと、
 *    **当たっていない版を CI が二度と当てなくなる**。除く版は、当たっていないものを探す SQL
 *    （読むだけ）で先に DB を見て決める。
 * 2. **記録の表もこの SQL で作るようにした。** ~~「先に `supabase migration list` を流せば CLI が表を作る」~~
 *    → 2026-11-17 に開発用で試すと、**今の CLI（2.122.0）は `migration list` では表を作らなかった**。
 *    表の形は、同じ日に `supabase migration repair --status applied` が開発用に作ったものをそのまま写した
 *    （`version text` 主キー・`statements text[]`・`name text`）。`if not exists` なので、表が既にあれば何もしない。
 */
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "supabase", "migrations");

/** ファイル名の先頭の数字が「版」。`20260907000001_create_users_table.sql` → `20260907000001` */
export function versionOf(fileName) {
  const match = fileName.match(/^(\d+)_/);
  return match ? match[1] : null;
}

/** `supabase/migrations/` の版を古い順に並べる */
export function readVersions(dir = MIGRATIONS_DIR) {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .map(versionOf)
    .filter((version) => version !== null)
    .sort();
}

/**
 * 記録表に書き込む SQL。
 *
 * 【初心者向け】`on conflict do nothing` を付けているので、**二度流しても安全**です。
 * 表が無い状態では流せないので、先に `npx supabase migration list --db-url ...` を
 * 一度実行して CLI に表を作らせてください（手順は docs/deployment.md）。
 */
/**
 * 除く版を取り除く。**ファイルに無い版を除こうとしたら止める**（打ち間違いに気づくため。
 * 打ち間違えたまま進むと、本当に除きたかった版が「当て済み」になってしまう）
 */
export function excludeVersions(versions, except) {
  const unknown = except.filter((version) => !versions.includes(version));
  if (unknown.length > 0) throw new Error(`除く版がファイルに無い: ${unknown.join(", ")}`);
  const skip = new Set(except);
  return versions.filter((version) => !skip.has(version));
}

/** `--except a,b` を読む。無ければ空 */
export function parseExcept(argv) {
  const index = argv.indexOf("--except");
  if (index < 0) return [];
  return (argv[index + 1] ?? "").split(",").map((value) => value.trim()).filter(Boolean);
}

export function buildRepairSql(versions, except = []) {
  const list = versions.map((version) => `    '${version}'`).join(",\n");
  const skipped = except.length > 0 ? except.join(", ") : "なし";
  return `-- #944: この ${versions.length} 本は「もう当たっている」と記録する（supabase db push を空振りさせるため）
-- 除いた版（当たっていないので記録しない）: ${skipped}
--
-- 記録の表が無ければ作る（2026-11-17 に CLI が作った形と同じ。既にあれば何もしない）
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text not null primary key,
  statements text[],
  name text
);

-- 流したあと、本数を確かめること:
--   select count(*) from supabase_migrations.schema_migrations;   -- ${versions.length} になる
--   npx supabase migration list --db-url "<接続文字列>"            -- Local と Remote が揃う
--
-- このファイルは scripts/migrations/build-repair-sql.mjs が作っています。手で直さないこと。
insert into supabase_migrations.schema_migrations (version)
select unnest(array[
${list}
])
on conflict (version) do nothing;
`;
}

// 直接実行されたときだけ出力する（テストから import しても何も起きない）
if (process.argv[1] && process.argv[1].endsWith("build-repair-sql.mjs")) {
  const except = parseExcept(process.argv);
  const versions = excludeVersions(readVersions(), except);
  if (process.argv.includes("--list")) {
    console.log(versions.join("\n"));
    console.error(`${versions.length} 本（除いた版: ${except.length > 0 ? except.join(", ") : "なし"}）`);
  } else {
    process.stdout.write(buildRepairSql(versions, except));
  }
}
