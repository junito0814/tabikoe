# Task 3: 行の表示と地図ピンの連携

> 出典: [itinerary-check.md](../../../user-stories/itinerary/itinerary-check.md)
> インデックス: [itinerary-check](00-index.md)

## 依存

- Task 1
- arrival-time Task 3
- pin-display-rules-v3 Task 1

## 実装内容

- 行のチェックボックス（時刻の下）。済みはスポット名に取り消し線＋薄字、位置は動かさない。もう一度タップで解除、確認なし
- Day タブの済み件数を更新する。しおり表示の地図（itinerary-map-and-post Task 1）で済みの番号ピンを灰色にする

## 成果物

- `src/components/itineraries/ItinerarySpotRow.tsx`（チェック）
- `src/components/itineraries/DayTabs.tsx`（件数）

## テスト要件

### 単体テスト
- チェックで取り消し線クラスが付き、順序が変わらないこと

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 4: 受入テスト（E2E）](04-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- チェックしてもスポットの位置（並び順）が変わらないこと
- チェック状態がメンバー全員に同じく表示されること
