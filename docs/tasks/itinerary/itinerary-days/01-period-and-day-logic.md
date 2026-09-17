# Task 1: 期間更新と Day 再計算

> 出典: [itinerary-days.md](../../../user-stories/itinerary/itinerary-days.md)
> インデックス: [itinerary-days](00-index.md)

## 依存

- itinerary-basics Task 1

## 実装内容

- `PATCH /api/itineraries/[id]`（start_date・end_date）で日数を再計算し、範囲外の `day_index` を NULL（未定）に更新する。期間解除は全スポットを未定にする
- `PATCH /api/itineraries/[id]/spots/[spotId]`（day_index）で Day を移動する。時刻があれば時刻順、無ければ末尾の `sort_order`
- Day の日付計算（Day n → start_date + n-1）を `day-utils.ts` に置く

## 成果物

- `src/lib/itineraries/day-utils.ts`
- `src/app/api/itineraries/[id]/spots/[spotId]/route.ts`

## テスト要件

### 単体テスト
- 3 日→2 日に縮めたとき Day 3 のスポットが未定になること
- Day n の日付計算
- 移動後の sort_order が末尾になること

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 3: 受入テスト（E2E）](03-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- しおりの期間を 3 日間にすると Day 1〜3 と未定のタブができ、スポットを Day 間で移動でき、期間を短くしても消えた日のスポットが未定に残ること（受入条件58）
