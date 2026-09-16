# Task 2: Day タブと Day 移動の UI

> 出典: [itinerary-days.md](../../../user-stories/itinerary/itinerary-days.md)
> インデックス: [itinerary-days](00-index.md)

## 依存

- Task 1
- itinerary-basics Task 3

## 実装内容

- Day タブ（Day 1／…／未定。各タブに「済み／全体」）。期間未設定では未定だけ
- 行の「Day n ▾」ドロップダウンで移動。画面は今の Day に留まり、トースト「Day 2 に移動しました [Day 2 を見る]」
- 「期間を変更」ダイアログ

## 成果物

- `src/components/itineraries/DayTabs.tsx`
- `src/components/itineraries/DayMoveDropdown.tsx`
- `src/components/itineraries/PeriodDialog.tsx`

## テスト要件

### 単体テスト
- タブ数が日数＋1 になること
- 移動後もタブが変わらずトーストが出ること

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 3: 受入テスト（E2E）](03-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- Day を移動しても画面が現在の Day に留まり、トーストから移動先の Day を開けること
