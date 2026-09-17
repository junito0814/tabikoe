# Task 1: しおり表示の地図（番号ピン・Day タブ・すべて）

> 出典: [itinerary-map-and-post.md](../../../user-stories/itinerary/itinerary-map-and-post.md)
> インデックス: [itinerary-map-and-post](00-index.md)

## 依存

- itinerary-basics Task 1
- map-display-v3 Task 2
- pin-display-rules-v3 Task 1

## 実装内容

- `/map?itinerary=<id>&day=<n>`：その Day のスポットに訪問順の番号ピン（`numbered`、済みは灰色）を出し、全体が収まる範囲（`fitBounds`）で開く。地図上に Day タブを重ね、「すべて」で全日を Day の色で色分け
- 左上「しおりに戻る」。番号ピンのタップで `/itineraries/[id]?day=<n>&spot=<id>`（該当行を強調）
- ピンの取得は `GET /api/itineraries/[id]`（Task 1 の API）から

## 成果物

- `src/components/map/ItineraryMapOverlay.tsx`
- `src/components/map/MapScreen.tsx`（itinerary モード）

## テスト要件

### 単体テスト
- Day 切替でピンが入れ替わること
- 済みが灰色になること
- 「すべて」で色分けになること

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 3: 受入テスト（E2E）](03-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 済みのスポットの番号ピンが灰色で表示されること
