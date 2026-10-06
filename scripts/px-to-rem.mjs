#!/usr/bin/env node
/**
 * #805（2026-10-06）: 文字の大きさを px から rem に置き換える
 * 出典: Issue #805「端末の「文字サイズ」設定が効くように、文字の大きさを px から rem にする」
 *
 * 【初心者向け】`text-[12px]` のように px で書くと、**端末の「文字を大きく」が効きません**
 * （px は「画面の点いくつ」という絶対の大きさ）。`rem` は「**根（html）の文字サイズの何倍か**」で、
 * 根の大きさはブラウザが端末の設定から決めます。だから rem にすると設定に追随します。
 * 既定（16px）のままの人には**今までと同じ見た目**です。
 *
 * 変えるのは**文字の大きさだけ**です。`h-8`・`w-8`（箱の大きさ）は Tailwind が元から rem なので触りません。
 *
 * 使い方:
 *   node scripts/px-to-rem.mjs          # 何が変わるか見るだけ
 *   node scripts/px-to-rem.mjs --apply  # 書き換える
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const apply = process.argv.includes("--apply");
const ROOTS = ["src/components", "src/app"];

/**
 * 置き換えないもの（絵の中の文字・iOS の拡大よけ）。
 * 絵（SVG）の中の文字は**絵の大きさと一緒に決まる**ので、端末の設定で変わると図形からはみ出します。
 */
const SKIP_FILES = [
  // ピンの数字・記号は SVG の font-size 属性（Tailwind ではない）なので元から対象外
];

const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.tsx?$/.test(entry)) files.push(path);
  }
};
for (const root of ROOTS) walk(root);

let changed = 0;
let total = 0;
for (const path of files) {
  if (SKIP_FILES.includes(path)) continue;
  const before = readFileSync(path, "utf8");
  const after = before.replace(/text-\[(\d+(?:\.\d+)?)px\]/g, (_match, px) => {
    total += 1;
    const rem = Number(px) / 16;
    // 0.8125 のように割り切れる値になる（16 の約数ではない 11px なども 2 進で割り切れる）
    return `text-[${rem}rem]`;
  });
  if (after !== before) {
    changed += 1;
    if (apply) writeFileSync(path, after);
  }
}

console.log(`${total} 個の text-[Npx] を ${changed} ファイルで${apply ? "置き換えました" : "見つけました（--apply で書き換え）"}`);
