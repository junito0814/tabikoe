// #896: 新しい Supabase プロジェクトを一から作るための SQL をまとめて書き出す。
//
// 使い方:  node scripts/build-new-project-sql.mjs
//   → scripts/new-project/NN-migrations.sql が出来る。SQL Editor に **番号順に** 貼って実行する。
//
// 【初心者向け】なぜこれが要るのか。
//   supabase/migrations/ には 1 本ずつ小さな SQL が並んでいる。新しいプロジェクトを作るときは
//   それを**全部・順番どおりに**流す必要があるが、50 本近くを 1 つずつ貼るのは現実的ではない。
//   かといって全部を 1 ファイルにすると、SQL Editor に貼るには大きすぎる。
//   そこで「順番を保ったまま、貼れる大きさに区切る」のがこのスクリプト。
//
//   **出力したファイルは手で編集しない。** 直すときは supabase/migrations/ を直して、これを流し直す
//   （約束 14: 同じものを 2 か所に書かない。写しができると片方だけ直してズレる）。
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

const SOURCE_DIR = "supabase/migrations";
const OUT_DIR = "scripts/new-project";
/** 1 ファイルの目安の大きさ。SQL Editor に貼って重くならない範囲 */
const MAX_BYTES = 60_000;

const files = readdirSync(SOURCE_DIR)
  .filter((name) => name.endsWith(".sql"))
  .sort(); // ファイル名が日付＋連番なので、辞書順＝適用順

if (files.length === 0) throw new Error(`${SOURCE_DIR} に .sql がありません`);

/** 1 本ぶんの中身に、どのファイル由来かの見出しを付ける */
function section(name) {
  const body = readFileSync(join(SOURCE_DIR, name), "utf8").replace(/\s+$/, "");
  const rule = "-- " + "=".repeat(70);
  return `\n${rule}\n-- ${name}\n${rule}\n${body}\n`;
}

// 順番を保ったまま、大きさで区切る
const parts = [];
let current = [];
let size = 0;
for (const name of files) {
  const text = section(name);
  if (size + text.length > MAX_BYTES && current.length > 0) {
    parts.push(current);
    current = [];
    size = 0;
  }
  current.push({ name, text });
  size += text.length;
}
if (current.length > 0) parts.push(current);

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

parts.forEach((part, index) => {
  const no = index + 1;
  const header =
    `-- #896: 新しい Supabase プロジェクトを作るための SQL（${no} / ${parts.length}）\n` +
    `-- supabase/migrations/ を順につないだもの。**手で編集しない**（node scripts/build-new-project-sql.mjs で作り直す）\n` +
    `--\n` +
    `-- 【初心者向け】使い方:\n` +
    `--   新しいプロジェクトの SQL Editor に、01 から順に貼って実行する。\n` +
    `--   **順番が大事**（先に作った表に、あとから列・権限・ポリシーを足しているため）。\n` +
    `--   途中でエラーが出たらそこで止めて、出た文言をそのまま伝えること。先へ進まない。\n` +
    `--\n` +
    `-- この回に入っているもの（${part.length} 本）:\n` +
    part.map((p) => `--   ${p.name}\n`).join("");
  const path = join(OUT_DIR, `${String(no).padStart(2, "0")}-migrations.sql`);
  writeFileSync(path, header + part.map((p) => p.text).join(""));
  console.log(`${path}  ${part.length} 本  ${Math.round(Buffer.byteLength(header + part.map((p) => p.text).join("")) / 1024)} KB`);
});

console.log(`\nマイグレーション ${files.length} 本 → ${parts.length} ファイル`);
console.log(`先頭: ${basename(files[0])}  末尾: ${basename(files[files.length - 1])}`);
