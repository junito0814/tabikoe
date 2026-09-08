# Task 2: album_members テーブルのスキーマ定義・マイグレーション

> 出典: [table-catalog.md](../../../user-stories/data-model/table-catalog.md)
> インデックス: [table-catalog](00-index.md)

## 依存

- post-creation [投稿関連テーブルのスキーマ定義・マイグレーション](../../posts/post-creation/01-post-schema-migration.md)（`trips`テーブルへのFK）
- signup-login [users テーブルのスキーマ定義・マイグレーション](../../account/signup-login/02-users-table-migration.md)（`users`テーブルへのFK）

## 実装内容

要件定義書5.3・3.6.3に準拠し、`album_members`テーブルを作成する。

- カラム：`id`, `trip_id`（FK→`trips.id`）, `user_id`（FK→`users.id`）, `role`（`owner`／`editor`／`viewer`）, `joined_at`
- `(trip_id, user_id)`に一意制約を設定する

## 成果物

- マイグレーションファイル

## テスト要件

### 単体テスト
- 対象外（DDLのため下記の結合テストでカバーする）

### 結合テスト
- Supabaseローカル環境でマイグレーションが冪等に適用できることを確認する
- F-AC-05 [Task2: アルバムオーナー継承ロジックの実装](../../account/account-deletion/02-album-owner-succession.md)の結合テストを本テーブルに対して実行し、成功することを確認する

### E2Eテスト
- なし（本タスクは画面を持たないため）

## 関連する受入条件

- 既存タスクが参照するテーブル（album_members等）すべてにスキーマ定義（マイグレーション）が存在すること
