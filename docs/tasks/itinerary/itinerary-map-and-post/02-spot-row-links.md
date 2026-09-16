# Task 2: 「投稿一覧」「投稿する」「投稿済み」の導線

> 出典: [itinerary-map-and-post.md](../../../user-stories/itinerary/itinerary-map-and-post.md)
> インデックス: [itinerary-map-and-post](00-index.md)

## 依存

- arrival-time Task 3
- post-entry-points Task 1

## 実装内容

- 行の「投稿一覧」→ `/spots/[id]`、「投稿する」→ `/posts/new?itinerary=<id>&spot=<id>`（旅行タイトル・訪問日＝Day の日付）
- その旅行でそのスポットに投稿があれば「投稿済み」を表示する（`get-itinerary.ts` で判定）

## 成果物

- `src/components/itineraries/ItinerarySpotRow.tsx`（導線）
- `src/lib/itineraries/get-itinerary.ts`（投稿済み判定）

## テスト要件

### 単体テスト
- 投稿済みの判定と表示
- 「投稿する」の href

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 3: 受入テスト（E2E）](03-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- しおりのスポットの「投稿する」で、スポット・旅行タイトル・訪問日（その Day の日付）が入力済みの SC-03 が開き、投稿がそのアルバムにまとまること（受入条件63）
- 投稿済みのスポットに「投稿済み」が表示されること
