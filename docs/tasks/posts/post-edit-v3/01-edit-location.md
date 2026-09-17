# Task 1: 編集画面での位置・スポットの変更

> 出典: [post-edit.md](../../../user-stories/posts/post-edit.md)
> インデックス: [post-edit-v3](00-index.md)

## 依存

- post-creation-v3 Task 3
- spot-selection-v3 Task 4

## 実装内容

- `/posts/[id]/edit` を `PostComposeScreen` に載せ替え、投稿のスポットで地図を固定した状態で開く。「変更」→「新しい場所」で選び直せる
- `PATCH /api/posts/[id]` で `spot_id`・`lat`・`lng` の変更を受け、`itinerary_spots`・`wishlist` は変更しない

## 成果物

- `src/app/posts/[id]/edit/page.tsx`
- `src/app/api/posts/[id]/route.ts`

## テスト要件

### 単体テスト
- 編集の初期状態が投稿のスポットで固定されていること

### 結合テスト
- スポットを変えても itinerary_spots／wishlist の行が変わらないこと

### E2Eテスト
- なし（[Task 2: 受入テスト（E2E）](02-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 編集画面でも地図で位置を選び直せ、スポットを変えてもしおり・行きたいの紐づきが変わらないこと
