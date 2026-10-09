// #896: データを触るスクリプトが「どのプロジェクトに繋ぐか」を 1 か所で決める。
//
// 【初心者向け】なぜこれが要るのか。
//   2026-10-07 に卒業制作を提出し、担当の方が本番を触っている。
//   ところが seed や掃除のスクリプトは `.env.local` の本番の鍵をそのまま読んでいたので、
//   **`node scripts/seed/seed-tokyo.mjs` と打つだけで本番が書き換わった**。
//   実際その日に、本番のスポット 51 件と写真 86 枚を入れ替えている。
//
//   そこで向き先を逆にした。
//     - 既定は **開発用**（DEV_SUPABASE_*）
//     - 本番に当てたいときだけ **`--production` を明示**する。警告を出し、少し待つ
//
//   「気をつける」ではなく「**既定で安全な側に倒す**」ための仕組み（約束 14: 判断は 1 か所に）。
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

/** .env.local を読む（dotenv を入れていないので自前で） */
export function readEnvLocal() {
  return Object.fromEntries(
    readFileSync(new URL("../.env.local", import.meta.url), "utf8")
      .split("\n")
      .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
      .map((line) => {
        const i = line.indexOf("=");
        return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^"|"$/g, "")];
      })
  );
}

/** 本番に当てるつもりかどうか（純粋関数。テストしやすいように引数で受ける） */
export function wantsProduction(argv) {
  return argv.includes("--production");
}

/**
 * どちらに繋ぐかを決めて、その設定を返す（純粋関数）。
 * 鍵そのものは返すが、**呼び出し側は決して画面に出さない**（約束 21）。
 */
export function resolveTarget(env, argv) {
  if (wantsProduction(argv)) {
    if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
      throw new Error(".env.local に NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY がありません");
    }
    return { label: "本番", isProduction: true, url: env.NEXT_PUBLIC_SUPABASE_URL, key: env.SUPABASE_SECRET_KEY };
  }
  if (!env.DEV_SUPABASE_URL || !env.DEV_SUPABASE_SECRET_KEY) {
    throw new Error(
      ".env.local に DEV_SUPABASE_URL / DEV_SUPABASE_SECRET_KEY がありません。\n" +
        "開発用の Supabase を作っていない場合は docs/deployment.md を見てください。\n" +
        "どうしても本番に当てるなら --production を付けます（担当の方が触っているので、原則やらない）。"
    );
  }
  return { label: "開発", isProduction: false, url: env.DEV_SUPABASE_URL, key: env.DEV_SUPABASE_SECRET_KEY };
}

/** 本番に当てるときの「待ち時間」。押し間違いに気づく猶予 */
export const PRODUCTION_PAUSE_MS = 5000;

/**
 * 繋ぎ先を決めて Supabase のクライアントを作る。どちらに繋いだかを必ず表示する。
 * 本番のときは赤い警告を出して 5 秒待つ（Ctrl+C で止められる）。
 */
export async function connect(argv = process.argv) {
  const env = readEnvLocal();
  const target = resolveTarget(env, argv);
  // ref だけ出す（鍵は出さない）。どちらに繋いだかが一目で分かるように
  const ref = target.url.replace(/^https:\/\/|\.supabase\.co.*$/g, "");
  if (target.isProduction) {
    console.log("\x1b[41m\x1b[37m%s\x1b[0m", ` ★ 本番（${ref}）に書き込みます。担当の方が触っています `);
    console.log(`   ${PRODUCTION_PAUSE_MS / 1000} 秒待ちます。違うなら Ctrl+C で止めてください。`);
    await new Promise((resolve) => setTimeout(resolve, PRODUCTION_PAUSE_MS));
  } else {
    console.log(`繋ぎ先: ${target.label}（${ref}）`);
  }
  const admin = createClient(target.url, target.key, { auth: { autoRefreshToken: false, persistSession: false } });
  return { admin, env, target };
}
