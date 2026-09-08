# Task 4: badges テーブルのスキーマ定義・マイグレーション

> 出典: [table-catalog.md](../../../user-stories/data-model/table-catalog.md)
> インデックス: [table-catalog](00-index.md)

## 依存

- signup-login [users テーブルのスキーマ定義・マイグレーション](../../account/signup-login/02-users-table-migration.md)

## 実装内容

要件定義書5.2・3.7に準拠し、`badges`テーブルを作成する。

- カラム：`id`, `user_id`（FK→`users.id`）, `badge_type`（例：都道府県バッジ／投稿数バッジ／いいね数バッジの種別とレベルを識別できる値）, `acquired_at`
- 3.7で定義される都道府県バッジ・投稿数バッジ・いいね数バッジのいずれも表現できる構造とする
- `(user_id, badge_type)`に一意制約を設定する

## 成果物

- マイグレーションファイル

## テスト要件

### 単体テスト
- 対象外（DDLのため下記の結合テストでカバーする）

### 結合テスト
- Supabaseローカル環境でマイグレーションが冪等に適用できることを確認する
- F-PO-03 [Task3: バッジ保持ロジックの回帰テスト](../../posts/post-delete/03-badge-retention-regression-test.md)の結合テストを本テーブルに対して実行し、成功することを確認する

### E2Eテスト
- なし（本タスクは画面を持たないため）

## 関連する受入条件

- 既存タスクが参照するテーブル（badges等）すべてにスキーマ定義（マイグレーション）が存在すること
