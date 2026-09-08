# Task 1: 「行きたい」保存・取消 Route Handler

> 出典: [wishlist.md](../../../user-stories/records/wishlist.md)
> インデックス: [wishlist](00-index.md)

## 依存

- table-catalog [Task5: 対話系テーブル（comments・likes・wishlist・blocks）のスキーマ定義・マイグレーション](../../data-model/table-catalog/05-interaction-tables.md)

## 実装内容

- `POST /api/wishlist`（保存）・`DELETE /api/wishlist/{spotId}`（取消）を実装する
- 保存はスポット単位（`spot_id`）で行い、投稿の有無・Google Places由来か手動登録かは問わない
- `(user_id, spot_id)`の一意制約により、同一スポットの重複保存を防ぐ

## 成果物

- `app/api/wishlist/route.ts`（POST）
- `app/api/wishlist/[spotId]/route.ts`（DELETE）

## テスト要件

### 単体テスト
- 既に保存済みのスポットへの再保存リクエストが、エラーにならず冪等に処理されることを検証する

### 結合テスト
- テスト用DBで、投稿が存在しないスポット（Google Places由来）を保存できることを確認する
- 保存を取り消すと`wishlist`からレコードが削除されることを確認する

### E2Eテスト
- なし（[Task 4: 受入テスト（E2E）](04-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 投稿カード一覧・投稿詳細のいずれからも、スポットを「行きたい」として保存・保存解除できること
- Google Places API由来のスポット（投稿が存在しない場合を含む）も保存できること
