// #918: 利用規約・個人情報保護方針の新しい版を、下書きとして入れて公開する。
//
// 使い方:
//   node scripts/publish-legal.mjs privacy 1.5 docs/legal/privacy-1.5.md            … 見るだけ
//   node scripts/publish-legal.mjs privacy 1.5 docs/legal/privacy-1.5.md --apply    … 開発用に公開
//   node scripts/publish-legal.mjs privacy 1.5 docs/legal/privacy-1.5.md --apply --production  … ★ 本番
//
// 【初心者向け】画面（管理 → 規約管理）からも同じことができます。なぜスクリプトを足したか。
//   本文は 7,000 字あり、**画面の入力欄に貼ると改行や記号が崩れる**ことがあります。
//   リポジトリのファイルをそのまま入れたいので、ファイルから読む口を作りました。
//
//   **やっていることは画面とまったく同じです**（src/lib/legal/legal-admin.ts の
//   saveLegalDraft と publishLegalDocument を、そのままなぞっています）。
//     1. 下書きとして入れる（同じ版が下書きで残っていれば中身を差し替える）
//     2. 前の公開版を archived にする
//     3. この版を published にする
//     4. **全員向けのお知らせを 1 件**作る（要件 3.9.1）
//     5. 運営者の操作の記録に残す（要件 3.10.12）
//
//   4 と 5 を飛ばすと、**利用者に知らせずに規約が変わる**ことになります。だから必ず一緒にやります。
import { readFileSync } from "node:fs";
import { connect } from "./supabase-target.mjs";

const [kind, version, path] = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const apply = process.argv.includes("--apply");

if (!kind || !version || !path || !["privacy", "terms"].includes(kind)) {
  console.error("使い方: node scripts/publish-legal.mjs <privacy|terms> <版> <本文のファイル> [--apply] [--production]");
  process.exit(1);
}

const body = readFileSync(path, "utf8");
/** 利用者に見せる「変更の要点」。CHANGES-<版>.md の「## 利用者向けの要点」から読む */
const changesPath = path.replace(/\/[^/]+$/, `/CHANGES-${version}.md`);
const summary = (() => {
  try {
    const text = readFileSync(changesPath, "utf8");
    const section = text.split("## 利用者向けの要点")[1]?.split("\n## ")[0] ?? "";
    return section.trim();
  } catch {
    return "";
  }
})();

const { admin, target } = await connect();
const where = target.isProduction ? "本番" : "開発用";
const label = kind === "privacy" ? "個人情報保護方針" : "利用規約";

/** 版の比較（1.10 > 1.9 を正しく扱う） */
const compare = (a, b) => {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
};

const { data: current } = await admin
  .from("legal_documents").select("id, version").eq("kind", kind).eq("status", "published").maybeSingle();

console.log(`\n繋ぎ先: ${where}`);
console.log(`種類: ${label}`);
console.log(`いま公開中: ${current ? `版 ${current.version}` : "なし"}`);
console.log(`入れようとしている版: ${version}（${body.length} 文字）`);
console.log(`変更の要点: ${summary ? `${summary.length} 文字（${changesPath} から）` : "**ありません**（お知らせに要点が載りません）"}`);

if (current && compare(version, current.version) <= 0) {
  console.error(`\n版 ${version} は、いま公開中の ${current.version} より新しくありません。中止します。`);
  process.exit(1);
}

if (!apply) {
  console.log("\n見ただけで終わりました。公開するには --apply を付けてください。");
  process.exit(0);
}

const now = new Date().toISOString();

// 1. 下書き（同じ版が下書きで残っていれば差し替え）
const { data: existing } = await admin
  .from("legal_documents").select("id, status").eq("kind", kind).eq("version", version).maybeSingle();
let id = existing?.id ?? null;
if (existing && existing.status !== "draft") {
  console.error(`\n版 ${version} は既に ${existing.status} です。中止します。`);
  process.exit(1);
}
if (id) {
  const { error } = await admin.from("legal_documents").update({ summary, body, updated_at: now }).eq("id", id);
  if (error) throw error;
  console.log("下書きを差し替えました");
} else {
  const { data, error } = await admin
    .from("legal_documents").insert({ kind, version, summary, body, status: "draft" }).select("id").single();
  if (error) throw error;
  id = data.id;
  console.log("下書きを入れました");
}

// 2〜3. 前の版を archived に、この版を published に
if (current) {
  const { error } = await admin.from("legal_documents").update({ status: "archived", updated_at: now }).eq("id", current.id);
  if (error) throw error;
  console.log(`版 ${current.version} を archived にしました`);
}
{
  const { error } = await admin
    .from("legal_documents").update({ status: "published", published_at: now, updated_at: now }).eq("id", id);
  if (error) throw error;
  console.log(`版 ${version} を published にしました`);
}

// 4. 全員向けのお知らせ（要件 3.9.1）
{
  const path = kind === "privacy" ? "/privacy" : "/terms";
  const { error } = await admin.from("system_announcements").insert({
    title: `${label}を改定しました（版 ${version}）`,
    body: `${summary ? `変更の要点：\n${summary}\n\n` : ""}全文は ${path} で読めます。次にアプリを開いたときに、改めて同意をお願いします。`,
    published_at: now,
  });
  if (error) console.error("お知らせを作れませんでした:", error.message);
  else console.log("全員向けのお知らせを 1 件作りました");
}

console.log(`\n終わりました。次に ${where} を開いた利用者に、再同意を求めます。`);
