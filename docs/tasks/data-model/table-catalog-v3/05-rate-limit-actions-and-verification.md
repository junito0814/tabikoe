# Task 5: rate_limits の action_type 追加と全マイグレーションの適用確認

> 出典: [table-catalog.md](../../../user-stories/data-model/table-catalog.md)
> インデックス: [table-catalog-v3](00-index.md)

## 依存

- Task 1〜4

## 実装内容

- `check-rate-limit.ts` の action 種別に `itinerary_invite`（1 時間 10 件）・`draft_save`（1 時間 60 件）・`spot_status_report`（1 日 50 件）を追加する
- `supabase db push` 相当で全マイグレーションをローカルまたは開発環境に適用し、`verify` SQL で列・制約・ポリシーの存在を確認する
- docs/tasks/data-model/table-catalog の実装状況表を更新する

## 成果物

- `src/lib/rate-limit/check-rate-limit.ts`
- `scripts/verify_20260917.sql`（確認クエリ）

## テスト要件

### 単体テスト
- 各 action の上限値と時間枠が定義どおりであることを検証する

### 結合テスト
- 新 4 テーブルと posts の新列が存在し、RLS が有効であることを確認する

### E2Eテスト
- なし（[Task 6: 受入テスト（E2E）](06-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- レート制限の上限に達した操作が、429エラーとともに拒否されること（受入条件34）
