# Task 1: 候補にアルバム・しおりの旅行を含める

> 出典: [trip-title.md](../../../user-stories/posts/trip-title.md)
> インデックス: [trip-title-v3](00-index.md)

## 依存

- table-catalog-v3 Task 3

## 実装内容

- `GET /api/trips`（候補）に、自分がオーナーの旅行に加えて、`album_members`／`itinerary_members` で参加中の旅行を含める（区別のラベル付き）
- `TripTitleInput` で候補のラベルを表示する

## 成果物

- `src/app/api/trips/route.ts`
- `src/components/trips/TripTitleInput.tsx`

## テスト要件

### 単体テスト
- 参加中のアルバム・しおりの旅行が候補に含まれ、ラベルが付くこと

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 3: 受入テスト（E2E）](03-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 参加中のアルバム・しおりの旅行タイトルが候補に出ること
