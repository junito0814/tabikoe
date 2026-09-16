# Task 1: チェック API（手動）

> 出典: [itinerary-check.md](../../../user-stories/itinerary/itinerary-check.md)
> インデックス: [itinerary-check](00-index.md)

## 依存

- itinerary-basics Task 1

## 実装内容

- `PATCH /api/itineraries/[id]/spots/[spotId]`（checked: true／false）で `checked_at`・`checked_by` を設定／解除する。メンバーのみ。通知は作らない

## 成果物

- `src/app/api/itineraries/[id]/spots/[spotId]/route.ts`（checked）

## テスト要件

### 単体テスト
- true→設定、false→解除

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 4: 受入テスト（E2E）](04-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- しおりのスポットをチェックすると取り消し線で表示され、しおりのメンバーがその旅行でそのスポットに投稿すると自動でチェックされ、メンバー以外の投稿では変わらないこと（受入条件60）
