# Task 1: rate_limits テーブルのスキーマ定義・マイグレーション

> 出典: [table-catalog.md](../../../user-stories/data-model/table-catalog.md)
> インデックス: [table-catalog](00-index.md)

## 依存

なし（土台タスク）

## 実装内容

要件定義書5.2に準拠し、`rate_limits`テーブルを作成する。

- カラム：`id`, `subject`（`user_id`またはIPアドレス）, `action_type`, `window_start`, `count`
- `(subject, action_type, window_start)`に一意制約またはインデックスを設定し、参照・更新を高速化する
- 判定処理をDB関数として実装する場合は、**`anon`・`authenticated`から実行できないようEXECUTE権限を絞る**（`revoke execute ... from public, anon, authenticated` の上で`service_role`にのみ付与する）
  - Supabaseは`public`スキーマの関数をPostgRESTのRPCとして公開し、PostgreSQLは新規関数に既定でPUBLICへEXECUTEを付与する。絞らないと、ブラウザに配布されるpublishable（anon）キーだけで任意の`subject`（他人のIPアドレス）のカウンタを加算でき、狙ったユーザーをログイン不能にできてしまう

## 成果物

- マイグレーションファイル
- 判定関数のEXECUTE権限設定（DB関数として実装する場合）

## テスト要件

### 単体テスト
- 対象外（DDLのため下記の結合テストでカバーする）

### 結合テスト
- Supabaseローカル環境でマイグレーションが冪等に適用できることを確認する
- F-AC-01 [Task8: ログイン試行のレート制限](../../account/signup-login/08-login-rate-limiting.md)の結合テストを本テーブルに対して実行し、成功することを確認する
- F-PO-01 [Task5: 投稿作成レート制限の実装](../../posts/post-creation/05-post-creation-rate-limiting.md)の結合テストを本テーブルに対して実行し、成功することを確認する

### E2Eテスト
- なし（本タスクは画面を持たないため）

## 関連する受入条件

- 既存タスクが参照するテーブル（rate_limits等）すべてにスキーマ定義（マイグレーション）が存在すること
