# F-MP-04 投稿検索・絞り込み — タスク分割

> 出典: [post-filter.md](../../../user-stories/map-search/post-filter.md)

各タスクの詳細・テスト要件は個別ファイルを参照。Task 1が土台。Task 2はTask 1に依存。Task 3は全体の結合後に実施する。

| # | タスク | 依存 |
|---|---|---|
| 1 | [投稿検索・絞り込み Route Handler](01-post-filter-handler.md) | pin-interaction Task1 |
| 2 | [絞り込みUI実装（SC-04）](02-filter-ui.md) | 1 |
| 3 | [受入テスト（E2E）](03-acceptance-e2e.md) | 1, 2 |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
