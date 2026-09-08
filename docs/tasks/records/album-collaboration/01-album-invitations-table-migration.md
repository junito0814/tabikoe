# Task 1: album_invitations テーブルのスキーマ定義・マイグレーション

> 出典: [album-collaboration.md](../../../user-stories/records/album-collaboration.md)
> インデックス: [album-collaboration](00-index.md)

## 依存

- table-catalog [Task2: album_members テーブルのスキーマ定義・マイグレーション](../../data-model/table-catalog/02-album-members-table.md)（`trips`テーブルへのFKパターンを揃える）

## 実装内容

要件定義書5.2に準拠し、`album_invitations`テーブルを作成する。既存の[table-catalog](../../data-model/table-catalog/00-index.md)ストーリーはこのテーブルを対象に含めていなかったため、本ストーリーで新規に定義する。

- カラム：`id`, `trip_id`（FK→`trips.id`）, `token`（招待URLに含める一意なランダム文字列）, `role`（付与する権限：`editor`／`viewer`）, `created_by`（FK→`users.id`、発行者）, `expires_at`（発行から7日後）, `revoked_at`（手動無効化日時、NULL可）, `created_at`
- `token`に一意制約を設定する

## 成果物

- マイグレーションファイル

## テスト要件

### 単体テスト
- 対象外（DDLのため下記の結合テストでカバーする）

### 結合テスト
- Supabaseローカル環境でマイグレーションが冪等に適用できることを確認する
- `token`の一意制約により重複トークンのINSERTが失敗することを確認する

### E2Eテスト
- なし（本タスクは画面を持たないため）

## 関連する受入条件

- なし（後続タスクの基盤となるスキーマ定義）
