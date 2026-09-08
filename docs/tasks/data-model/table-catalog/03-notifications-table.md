# Task 3: notifications テーブルのスキーマ定義・マイグレーション

> 出典: [table-catalog.md](../../../user-stories/data-model/table-catalog.md)
> インデックス: [table-catalog](00-index.md)

## 依存

- signup-login [users テーブルのスキーマ定義・マイグレーション](../../account/signup-login/02-users-table-migration.md)

## 実装内容

要件定義書5.2に準拠し、`notifications`テーブルを作成する。

- カラム：`id`, `user_id`（FK→`users.id`）, `type`, `related_id`, `is_read`, `created_at`
- `(user_id, is_read)`にインデックスを設定し、未読件数取得を高速化する

## 成果物

- マイグレーションファイル

## テスト要件

### 単体テスト
- 対象外（DDLのため下記の結合テストでカバーする）

### 結合テスト
- Supabaseローカル環境でマイグレーションが冪等に適用できることを確認する
- F-AC-05 [Task2: アルバムオーナー継承ロジックの実装](../../account/account-deletion/02-album-owner-succession.md)（新オーナー選出通知のINSERT）の結合テストを本テーブルに対して実行し、成功することを確認する
- menu-bar [Task2: 通知未読件数バッジの表示](../../shared-ui/menu-bar/02-unread-notification-badge.md)の結合テストを本テーブルに対して実行し、成功することを確認する

### E2Eテスト
- なし（本タスクは画面を持たないため）

## 関連する受入条件

- 既存タスクが参照するテーブル（notifications等）すべてにスキーマ定義（マイグレーション）が存在すること
