# Task 1: いいね付与・取り消し Route Handler

> 出典: [likes.md](../../../user-stories/browsing/likes.md)
> インデックス: [likes](00-index.md)

## 依存

- table-catalog [Task5: 対話系テーブル（comments・likes・wishlist・blocks）のスキーマ定義・マイグレーション](../../data-model/table-catalog/05-interaction-tables.md)

## 実装内容

- 投稿へのいいね付与・取り消しを行うRoute Handlerを実装する（例：`POST /api/posts/{id}/like`、`DELETE /api/posts/{id}/like`）
- `likes`テーブルの`(post_id, user_id)`一意制約により、同一ユーザーからの重複いいねを防止する
- 対象投稿が非公開設定の場合はリクエストを拒否する

## 成果物

- `app/api/posts/[id]/like/route.ts`（POST/DELETE）

## テスト要件

### 単体テスト
- 未いいねの投稿にいいねを付与できることを検証する
- 既にいいね済みの投稿へ再度いいねしようとした場合、重複登録されないことを検証する
- いいね済みの投稿からいいねを取り消せることを検証する
- 非公開投稿へのいいね付与リクエストが拒否されることを検証する

### 結合テスト
- テスト用DBで実際に`likes`テーブルへの登録・削除が行われることを確認する

### E2Eテスト
- なし（[Task 4: 受入テスト（E2E）](04-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 投稿にいいねを付与・取り消しできること
- いいねが1ユーザー1投稿1件に制限されること
- 公開設定が「公開」の投稿のみがいいねの対象であること
