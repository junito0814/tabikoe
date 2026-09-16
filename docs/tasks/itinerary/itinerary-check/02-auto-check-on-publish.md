# Task 2: 投稿公開時の自動チェック

> 出典: [itinerary-check.md](../../../user-stories/itinerary/itinerary-check.md)
> インデックス: [itinerary-check](00-index.md)

## 依存

- itinerary-basics Task 1
- post-creation-v3 Task 1
- draft Task 3

## 実装内容

- `auto-check.ts`：投稿の公開処理（POST published／draft の publish）の中で、投稿者が `itinerary_members` にいる同じ `trip_id` のしおりに同じ `spot_id` の行があれば `checked_at = now()`・`checked_by = 投稿者` を設定する。下書きでは実行しない
- 投稿削除ではチェックを外さない

## 成果物

- `src/lib/itineraries/auto-check.ts`
- `src/app/api/posts/route.ts`・`src/lib/posts/publish-draft.ts`（呼び出し）

## テスト要件

### 単体テスト
- メンバーの投稿でチェックされ、非メンバー（アルバムメンバー）の投稿では変わらないこと
- 下書きでは呼ばれないこと

### 結合テスト
- 公開後に itinerary_spots.checked_at が入ること

### E2Eテスト
- なし（[Task 4: 受入テスト（E2E）](04-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 下書きの保存では自動チェックされず、公開した時点でチェックされること
