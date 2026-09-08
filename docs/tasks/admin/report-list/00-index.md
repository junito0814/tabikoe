# F-AD-04 通報一覧 — タスク分割

> 出典: [report-list.md](../../../user-stories/admin/report-list.md)

各タスクの詳細・テスト要件は個別ファイルを参照。Task 1が土台、Task 2はTask 1に依存する。Task 3は全体の結合後に実施する。`reports`テーブルの定義はsafety（F-SF-01、通報機能本体）が所有し、本ストーリーは読み取り・絞り込みのみを扱う。

| # | タスク | 依存 |
|---|---|---|
| 1 | [通報一覧取得・絞り込み Route Handler](01-report-list-handler.md) | safety/reporting Task1（reportsテーブル）, admin-login Task1 |
| 2 | [通報一覧画面UI（SC-18・一覧部分）](02-report-list-ui.md) | 1 |
| 3 | [受入テスト（E2E）](03-acceptance-e2e.md) | 1, 2 |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
