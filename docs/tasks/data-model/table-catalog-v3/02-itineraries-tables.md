# Task 2: itineraries・itinerary_spots テーブルと RLS

> 出典: [table-catalog.md](../../../user-stories/data-model/table-catalog.md)
> インデックス: [table-catalog-v3](00-index.md)

## 依存

- なし

## 実装内容

- `itineraries`（id・trip_id UNIQUE・start_date・end_date NULL 可・created_at・updated_at）を作成する。`trip_id` は `trips.id` を参照し、旅行削除時に連動削除する
- `itinerary_spots`（id・itinerary_id・spot_id・day_index NULL 可・arrival_time time NULL 可・sort_order・memo・checked_at・checked_by・created_at）を作成し、`(itinerary_id, spot_id)` に UNIQUE を付ける。`arrival_time` は分が 10 の倍数である CHECK を付ける
- RLS：両テーブルとも、`itinerary_members` に自分の行があるしおりだけ SELECT／INSERT／UPDATE／DELETE できるポリシーを付ける（Task 3 のテーブルを参照するため、ポリシーは Task 3 と同じマイグレーションで有効化してもよい）

## 成果物

- `supabase/migrations/20260917000002_itineraries.sql`

## テスト要件

### 単体テスト
- なし

### 結合テスト
- 同じ trip_id で 2 つ目の itineraries が UNIQUE 違反になること
- 同じ (itinerary_id, spot_id) の 2 行目が UNIQUE 違反になること
- arrival_time が 10 分刻みでない値で CHECK 違反になること

### E2Eテスト
- なし（[Task 6: 受入テスト（E2E）](06-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 1 つの旅行に 2 つ目のしおりを作れないこと
- 同じスポットを同じしおりに 2 回入れられないこと
