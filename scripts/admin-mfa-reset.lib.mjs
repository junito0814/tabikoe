// admin-mfa-reset.mjs の「判断」の部分だけを集めたもの（純粋関数。外に触らない）
// 出典: docs/tasks/admin/admin-login/08-mfa-recovery.md
//
// 【初心者向け】スクリプト本体（admin-mfa-reset.mjs）は node で直接動かすため .mjs で置いている。
// 判断だけをこのファイルに分けておくと、単体テスト（src/lib/admin/mfa-reset-cli.test.ts）から
// そのまま読み込んで確かめられる。同じ判断を 2 か所に書かないための分け方（AGENTS.md 13・14）。

/** ざっくりしたメールアドレスの形。ここで弾くのは打ち間違いで、正しさの保証ではない */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * コマンドラインの引数を読む。`process.argv.slice(2)` を渡す。
 * @returns {{ok: true, email: string} | {ok: false, message: string}}
 */
export function parseArgs(argv) {
  const args = (argv ?? []).filter((value) => typeof value === "string" && value.length > 0);
  if (args.length === 0) {
    return { ok: false, message: "使い方: node scripts/admin-mfa-reset.mjs <メールアドレス>" };
  }
  if (args.length > 1) {
    return { ok: false, message: "引数はメールアドレス 1 つだけです" };
  }
  const email = args[0].trim();
  if (!EMAIL.test(email)) {
    return { ok: false, message: `メールアドレスの形ではありません: ${email}` };
  }
  return { ok: true, email };
}

/**
 * 画面に出す 1 行。**秘密（secret・URI）は絶対に混ぜない**（AGENTS.md 21）。
 * 出すのは「どれを消すか見分けるための情報」だけ。
 */
export function formatFactorLine(factor) {
  const parts = [
    factor?.id ?? "(id なし)",
    factor?.factor_type ?? "(種類なし)",
    factor?.friendly_name ?? "(名前なし)",
    factor?.status ?? "(状態なし)",
    factor?.created_at ?? "(日時なし)",
  ];
  return `  - ${parts.join(" / ")}`;
}

/** 確認の入力。`yes` とだけ打たれたときだけ進む（y・Y・はい では進まない） */
export function isConfirmed(input) {
  return typeof input === "string" && input.trim() === "yes";
}

/** 消すものが無いときの言い回し（何もしないで終わる） */
export function nothingToDeleteMessage(email) {
  return `${email} には認証アプリの登録がありません。消すものはありません`;
}
