import { expect, test } from "./fixtures/test";
import { readdirSync } from "node:fs";
import { queryScalar } from "./fixtures/reset";
import { resetAndSeed, SEED } from "./fixtures/seed";

/**
 * e2e-foundation Task 2: 結合テスト（ローカルの Supabase に本当に繋いで確かめる）
 * 出典: docs/tasks/shared-ui/e2e-foundation/02-local-supabase.md「テスト要件 › 結合テスト」
 *
 * 【初心者向け】ブラウザは開きません。E2E の土台（DB と種データ）そのものが正しく動くかを見ています。
 * ここが落ちたら、画面のテスト（Task 5）が落ちても原因は画面ではなく土台です。
 */
test("空の DB にマイグレーションが全部当たり、テーブルが 29 本できている", () => {
  const files = readdirSync("supabase/migrations").filter((name) => name.endsWith(".sql"));
  const applied = Number(queryScalar("select count(*) from supabase_migrations.schema_migrations;"));
  expect(applied).toBe(files.length);

  const tables = Number(
    queryScalar("select count(*) from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE';")
  );
  expect(tables).toBe(29);
});

test("種データを入れ直すと、投稿 2 件・下書き 1 件に戻る（作り直しが効いている）", async () => {
  // テストの前に 1 回作り直されている（fixtures/test.ts）。そこへわざと 1 件足して、もう一度作り直す
  queryScalar(
    `insert into public.posts (user_id, trip_id, lat, lng, status) values ('${SEED.users.taro.id}', '${SEED.trip.id}', 35.0, 139.0, 'draft');`
  );
  expect(Number(queryScalar("select count(*) from public.posts where status = 'draft';"))).toBe(2);

  await resetAndSeed();

  expect(Number(queryScalar("select count(*) from public.posts where status = 'published';"))).toBe(2);
  expect(Number(queryScalar("select count(*) from public.posts where status = 'draft';"))).toBe(1);
  expect(Number(queryScalar("select count(*) from public.post_photos;"))).toBe(1);
  expect(Number(queryScalar("select count(*) from auth.users;"))).toBe(2);
  // マイグレーションが入れたデータは消えていない（同意の判定・自動非表示の設定）
  expect(Number(queryScalar("select count(*) from public.legal_documents;"))).toBeGreaterThan(0);
  expect(Number(queryScalar("select count(*) from public.moderation_settings;"))).toBeGreaterThan(0);
});
