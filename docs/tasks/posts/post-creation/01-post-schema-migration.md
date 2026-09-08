# Task 1: 投稿関連テーブルのスキーマ定義・マイグレーション

> 出典: [post-creation.md](../../../user-stories/posts/post-creation.md)
> インデックス: [post-creation](00-index.md)

## 依存

なし（土台タスク。`trips`・`spots`テーブルは[trip-title](../trip-title/00-index.md)・[spot-selection](../spot-selection/00-index.md)の各タスクからも参照される）

## 実装内容

要件定義書5.2のテーブル一覧に準拠し、以下のテーブルを作成する。

- `trips`：`id`, `user_id`, `title`, `created_at`
- `spots`：`id`, `name`, `lat`, `lng`, `prefecture`, `source`（`places`／`manual`）
- `posts`：`id`, `user_id`, `trip_id`, `spot_id`, `category`, `visit_date`, `duration`, `cost`, `rating`, `comment`, `visibility`, `created_at`
- `post_photos`：`id`, `post_id`, `media_type`（`photo`／`video`）, `storage_url`, `video_url`, `duration_seconds`, `display_order`
- 外部キー制約（`posts.trip_id → trips.id`、`posts.spot_id → spots.id`、`post_photos.post_id → posts.id`）
- RLS基本ポリシー：投稿者本人は自分の投稿を作成・更新・削除可能。公開設定（`visibility='public'`）の投稿は誰でも参照可能

## 成果物

- マイグレーションファイル一式

## テスト要件

### 単体テスト
- 対象外（DDL・ポリシー定義そのものは下記の結合テストでカバーする）

### 結合テスト
- Supabaseローカル環境でマイグレーションが冪等に適用できることを確認する
- 外部キー制約により、存在しない`trip_id`／`spot_id`を指定した`posts`のINSERTが失敗することを確認する
- RLSポリシーについて、他ユーザーの投稿を更新・削除できないこと、非公開投稿は投稿者本人以外が参照できないことを確認する

### E2Eテスト
- なし（本タスクは画面を持たないため）

## 関連する受入条件

- なし（後続タスクの基盤となるスキーマ定義）
