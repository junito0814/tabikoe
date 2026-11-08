import { execFileSync } from "node:child_process";
import { DB_CONTAINER } from "./local-supabase";

/**
 * e2e-foundation Task 2: ローカルの DB を「マイグレーションを当てた直後」に戻す
 * 出典: docs/tasks/shared-ui/e2e-foundation/02-local-supabase.md
 *
 * 【初心者向け】テストごとに作り直すのは、**テストの順番で結果が変わらないようにする**ためです。
 * 前のテストが投稿を 1 件増やしたまま次のテストに渡すと、「投稿が 2 件ある」は順番次第で通ったり落ちたりします。
 *
 * 消すもの: public のテーブルのうち、下の 2 つ以外の全部と、ログインの利用者（auth.users）。
 * 残すもの: マイグレーションが最初から入れているデータ（2026-11-08 に空の DB で確かめた）。
 *   - legal_documents … 利用規約・個人情報保護方針の公開中の版（同意の判定に使う）
 *   - moderation_settings … 自動非表示の閾値などの設定
 * **利用者（public.users）だけは truncate ではなく delete で消す。** `legal_documents.published_by` が利用者を指していて、
 * truncate の cascade は「指している側のテーブル」ごと空にしてしまうため（最初はこれで規約の版が消えた。
 * 2026-11-08、結合テストで見つけた）。delete なら参照側の決まり（ON DELETE SET NULL）が働き、行は残る。
 * auth.users を delete すると public.users も一緒に消える（ON DELETE CASCADE）。
 * 写真のファイル（Storage）は消さない。種データは毎回同じ置き場所に上書きするので増えない。
 *
 * Postgres に繋ぐライブラリは入れていないので、Docker の中の psql に SQL を渡す。
 */
export const KEEP_TABLES = ["legal_documents", "moderation_settings"] as const;
/** truncate しないで、あとで delete するテーブル（上の説明） */
export const DELETE_INSTEAD = ["users"] as const;

/** 空にする SQL（純粋関数。テストしやすいように文字列を返すだけ） */
export function buildResetSql(keep: readonly string[] = KEEP_TABLES): string {
  const keepList = [...keep, ...DELETE_INSTEAD].map((name) => `'${name}'`).join(", ");
  return `
do $$
declare r record;
begin
  for r in
    select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE' and table_name not in (${keepList})
  loop
    execute format('truncate table public.%I restart identity cascade', r.table_name);
  end loop;
  -- public.users も一緒に消える（ON DELETE CASCADE）。legal_documents.published_by は空欄になるだけ
  delete from auth.users;
end $$;`;
}

export function resetDatabase(): void {
  execFileSync("docker", ["exec", "-i", DB_CONTAINER, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-q"], {
    input: buildResetSql(),
    stdio: ["pipe", "ignore", "inherit"],
  });
}

/** 結合テスト用: SQL を 1 本流して、1 つの値を返す */
export function queryScalar(sql: string): string {
  return execFileSync("docker", ["exec", "-i", DB_CONTAINER, "psql", "-U", "postgres", "-tA", "-v", "ON_ERROR_STOP=1"], {
    input: sql,
    encoding: "utf8",
  }).trim();
}
