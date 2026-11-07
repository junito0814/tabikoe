// e2e-foundation Task 2: `npm run test:e2e` の入口。ローカルの Supabase を起動してから Playwright を動かし、終わったら止める
// 出典: docs/tasks/shared-ui/e2e-foundation/02-local-supabase.md
//
// 【初心者向け】なぜ Playwright の設定（globalSetup）ではなく、ここで起動するのか。
//   アプリ（next build → next start）は、ビルドの時点で Supabase の URL を中に焼き込みます。
//   だから**アプリを作る前に** Supabase が動いていて、その URL が分かっている必要があります。
//   Playwright はアプリの起動を先にやってしまうので、その手前のここで起動しておきます。
//
// やること
//   1. Docker が動いているか確かめる。動いていなければ**理由を出して止める**（黙って落ちない）
//   2. Supabase が止まっていれば起動する（初回は部品のダウンロードで数分かかる）
//   3. Playwright を動かす（引数はそのまま渡す。例: npm run test:e2e -- --browser=webkit）
//   4. **自分で起動したときだけ**止める。もともと動いていたなら、そのままにする
import { spawnSync } from "node:child_process";

function run(command, args, options = {}) {
  return spawnSync(command, args, { stdio: "inherit", ...options });
}

function quiet(command, args) {
  return spawnSync(command, args, { stdio: "ignore" }).status === 0;
}

if (!quiet("docker", ["info"])) {
  console.error("\n✗ Docker が動いていません。Docker Desktop を起動してから、もう一度 `npm run test:e2e` を実行してください。");
  console.error("  E2E は Docker の中のローカル Supabase を使います（本番・開発用の DB は使いません）。\n");
  process.exit(1);
}

const wasRunning = quiet("npx", ["supabase", "status"]);
if (!wasRunning) {
  console.log("ローカルの Supabase を起動します（初回は数分かかります）…");
  const started = run("npx", ["supabase", "start"], { stdio: ["ignore", "ignore", "inherit"] });
  if (started.status !== 0) {
    console.error("\n✗ ローカルの Supabase を起動できませんでした。上のエラーを見てください。\n");
    process.exit(started.status ?? 1);
  }
}

const result = run("npx", ["playwright", "test", ...process.argv.slice(2)]);

if (!wasRunning && !process.env.E2E_KEEP_SUPABASE) {
  console.log("ローカルの Supabase を止めます（残したいときは E2E_KEEP_SUPABASE=1）…");
  run("npx", ["supabase", "stop"], { stdio: "ignore" });
}

process.exit(result.status ?? 1);
