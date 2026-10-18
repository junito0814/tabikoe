#!/usr/bin/env node
/**
 * #944: 「52 本はもう当たっている」と記録表に書き込む SQL を作る。
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
 *
 * **このスクリプトは DB に接続しません。** 出てきた SQL を、
 * 開発用 → 本番の順に SQL エディタへ貼って実行してください（当てる手順は docs/deployment.md）。
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
export function buildRepairSql(versions) {
  const list = versions.map((version) => `    '${version}'`).join(",\n");
  return `-- #944: この ${versions.length} 本は「もう当たっている」と記録する（supabase db push を空振りさせるため）
--
-- 流す前に、表を作らせておくこと:
--   npx supabase migration list --db-url "<接続文字列>"
--
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
  const versions = readVersions();
  if (process.argv.includes("--list")) {
    console.log(versions.join("\n"));
    console.error(`${versions.length} 本`);
  } else {
    process.stdout.write(buildRepairSql(versions));
  }
}
