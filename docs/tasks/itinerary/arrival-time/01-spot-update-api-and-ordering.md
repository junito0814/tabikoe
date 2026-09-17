# Task 1: スポット更新 API と並び順ロジック

> 出典: [arrival-time.md](../../../user-stories/itinerary/arrival-time.md)
> インデックス: [arrival-time](00-index.md)

## 依存

- itinerary-basics Task 1

## 実装内容

- `PATCH /api/itineraries/[id]/spots/[spotId]`（arrival_time・sort_order・memo）。arrival_time は 10 分刻みを検証、memo は 500 文字（書記素）
- `DELETE` でしおりから外す（投稿・wishlist は不変）
- 並び順の純粋関数 `order-spots.ts`：時刻あり→時刻順、無し→sort_order 順で末尾。取得 API はこの順で返す

## 成果物

- `src/app/api/itineraries/[id]/spots/[spotId]/route.ts`
- `src/lib/itineraries/order-spots.ts`

## テスト要件

### 単体テスト
- 並び順関数（時刻あり／無し混在）
- 10 分刻み以外と 501 文字の拒否

### 結合テスト
- 削除後も posts・wishlist が残ること

### E2Eテスト
- なし（[Task 4: 受入テスト（E2E）](04-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- メモが 500 文字（書記素クラスタ単位）を超えると保存できないこと
- スポットをしおりから外しても、投稿と行きたいに影響しないこと
