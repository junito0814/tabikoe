# Task 2: ローカル Supabase と種データ

> 出典: [e2e-foundation.md](../../../user-stories/shared-ui/e2e-foundation.md)
> インデックス: [e2e-foundation](00-index.md)

## 依存

- なし

## 実装内容

**使い捨ての 3 つ目のデータベースを用意する。** 本番は当然さわれず、開発用（`tabikoe-dev`、#896 で分けた）も E2E で壊すと画面確認ができなくなる。

- Supabase CLI の設定（`supabase/config.toml`）を E2E で使える状態にする。**すでに `supabase/migrations/` に 53 本あるので、`supabase start` で空の DB にそれが順に当たること**をまず確かめる
  - 当たらないものがあれば、**マイグレーション側を直さずに記録だけ残す**。本番に当てた SQL を後から書き換えると、本番と記録がずれる（[deployment.md](../../../deployment.md)）。直し方は別の Issue にする
- E2E 用の種データを作る（`e2e/fixtures/seed.ts` など）。**画面確認用の `scripts/seed/seed-tokyo.mjs` とは別にする** ── あちらは見た目を確かめるための量（多い）で、E2E は**毎回同じ結果になる最小限**が要る
  - 利用者 2 名（うち 1 名は管理者）、旅行 1 件、スポット 2 件、公開投稿 2 件、下書き 1 件
  - 投稿には写真を 1 枚付ける（Storage に実ファイルを置く。一覧・詳細の表示に要る）
- テストごとに**作り直す**仕組みを入れる（各テストの前に対象のテーブルを空にして種を入れ直す）。テストの順番で結果が変わらないようにする
- `npm run test:e2e` から Supabase の起動・停止ができるようにする（Docker が動いていなければ**理由を出して止める**。黙って落ちない）

## 成果物

- `supabase/config.toml`（E2E 用の設定）
- `e2e/fixtures/seed.ts`
- `e2e/fixtures/reset.ts`
- `package.json`（`test:e2e` の前後処理）
- `docs/development-process.md`（E2E の動かし方を「テスト」節に追記）

## テスト要件

### 単体テスト

- なし（種データの投入は Supabase への書き込みそのもので、切り出せる判断が無い）

### 結合テスト

- 空の DB にマイグレーション 53 本が当たり、テーブルが 29 本できること
- 種データを入れ直したあと、投稿が 2 件・下書きが 1 件であること（作り直しが効いていること）

### E2Eテスト

- なし（Task 5 で使う）

## 関連する受入条件

- `npm run test:e2e` でローカル Supabase が立ち上がり、E2E が走って結果が出ること
