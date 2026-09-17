# Task 4: spot_status_reports テーブルと RLS

> 出典: [table-catalog.md](../../../user-stories/data-model/table-catalog.md)
> インデックス: [table-catalog-v3](00-index.md)

## 依存

- なし

## 実装内容

- `spot_status_reports`（spot_id・user_id・status（still_there／gone）・reported_at、主キー (spot_id, user_id)）を作成する
- RLS：SELECT は全ログインユーザー、INSERT／UPDATE は `user_id = auth.uid()` のみ
- 最新 1 件を返すビュー `spot_latest_status`（spot_id・status・reported_at）を作り、投稿一覧の埋め込みに使う

## 成果物

- `supabase/migrations/20260917000004_spot_status_reports.sql`

## テスト要件

### 単体テスト
- なし

### 結合テスト
- 同じ (spot_id, user_id) の 2 行目が主キー違反になり、UPSERT で上書きできること
- ビューがスポットごとに最新の 1 件だけを返すこと

### E2Eテスト
- なし（[Task 6: 受入テスト（E2E）](06-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 投稿詳細の「まだあった／無くなっていた」が 1 人 1 件で上書きできること（受入条件55）
