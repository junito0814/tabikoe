# Task 5: 対話系テーブル（comments・likes・wishlist・blocks）のスキーマ定義・マイグレーション

> 出典: [table-catalog.md](../../../user-stories/data-model/table-catalog.md)
> インデックス: [table-catalog](00-index.md)

## 依存

- signup-login [users テーブルのスキーマ定義・マイグレーション](../../account/signup-login/02-users-table-migration.md)
- post-creation [投稿関連テーブルのスキーマ定義・マイグレーション](../../posts/post-creation/01-post-schema-migration.md)（`posts`・`spots`テーブルへのFK）

## 実装内容

要件定義書5.2に準拠し、以下4テーブルを作成する。いずれも退会処理（F-AC-05）が削除・匿名化の対象として参照している。

- `comments`：`id`, `post_id`（FK→`posts.id`）, `user_id`（FK→`users.id`）, `body`, `created_at`
- `likes`：`id`, `post_id`（FK→`posts.id`）, `user_id`（FK→`users.id`）, `created_at`。`(post_id, user_id)`に一意制約
- `wishlist`：`id`, `user_id`（FK→`users.id`）, `spot_id`（FK→`spots.id`）, `created_at`。`(user_id, spot_id)`に一意制約
- `blocks`：`id`, `blocker_id`（FK→`users.id`）, `blocked_id`（FK→`users.id`）, `created_at`。`(blocker_id, blocked_id)`に一意制約

## 成果物

- マイグレーションファイル

## テスト要件

### 単体テスト
- 対象外（DDLのため下記の結合テストでカバーする）

### 結合テスト
- Supabaseローカル環境でマイグレーションが冪等に適用できることを確認する
- F-AC-05 [Task1: 退会実行 Route Handler（ユーザー匿名化・関連データ削除）](../../account/account-deletion/01-deactivation-handler.md)の結合テストを本テーブルに対して実行し、`comments`は残存・`likes`/`wishlist`/`blocks`は削除される想定どおりに動作することを確認する

### E2Eテスト
- なし（本タスクは画面を持たないため）

## 関連する受入条件

- 既存タスクが参照するテーブル（comments, likes, wishlist, blocks）すべてにスキーマ定義（マイグレーション）が存在すること
