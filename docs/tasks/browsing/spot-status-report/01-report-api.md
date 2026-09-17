# Task 1: 報告 API（upsert・レート制限）

> 出典: [spot-status-report.md](../../../user-stories/browsing/spot-status-report.md)
> インデックス: [spot-status-report](00-index.md)

## 依存

- table-catalog-v3 Task 4
- table-catalog-v3 Task 5

## 実装内容

- `PUT /api/spots/[id]/status`（body: still_there／gone）で `spot_status_reports` に UPSERT する。レート制限 `spot_status_report`（1 日 50 件）。通知は作らない
- `GET /api/spots/[id]/status` で最新 1 件と自分の報告を返す

## 成果物

- `src/app/api/spots/[id]/status/route.ts`
- `src/lib/spots/status-report.ts`

## テスト要件

### 単体テスト
- 2 回目の報告が上書きになること（モック）
- 不正な status が 400 になること

### 結合テスト
- 同一ユーザーの 2 回目で行数が増えないこと
- notifications に行が増えないこと

### E2Eテスト
- なし（[Task 4: 受入テスト（E2E）](04-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 投稿詳細の「まだあった／無くなっていた」が 1 人 1 件で上書きでき、最新の報告が「9月にまだあった」のように投稿カードと詳細に表示され、投稿者に通知されないこと（受入条件55）
