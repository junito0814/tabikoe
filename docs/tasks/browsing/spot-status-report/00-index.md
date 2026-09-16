# F-VW-04 「まだあった」報告 — タスク分割

> 出典: [spot-status-report.md](../../../user-stories/browsing/spot-status-report.md)

Task 1 が土台。Task 2・3 は Task 1 の後に並行できる。

| # | タスク | 依存 |
|---|---|---|
| 1 | [報告 API（upsert・レート制限）](01-report-api.md) | table-catalog-v3 Task 4、table-catalog-v3 Task 5 |
| 2 | [投稿詳細の 2 ボタンと表示](02-detail-buttons-and-display.md) | Task 1、post-detail-view-v3 Task 1 |
| 3 | [一覧・吹き出しへの最新報告の埋め込み](03-embed-latest-status.md) | Task 1、post-timeline Task 1、map-display-v3 Task 1 |
| 4 | [受入テスト（E2E）](04-acceptance-e2e.md) | Task 1〜3 すべて |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
