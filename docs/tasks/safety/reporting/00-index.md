# F-SF-01 通報 — タスク分割

> 出典: [reporting.md](../../../user-stories/safety/reporting.md)

各タスクの詳細・テスト要件は個別ファイルを参照。Task 1が土台。Task 2・3はTask 1完了後に並行して着手できる。Task 4はTask 3に依存。Task 5は全体の結合後に実施する。対応状態の更新・通報者への通知は管理者機能（F-AD-05 通報対応操作）の範囲であり、本ストーリーのタスクには含まない。

| # | タスク | 依存 |
|---|---|---|
| 1 | [reports テーブルのスキーマ定義・マイグレーション](01-reports-schema-migration.md) | なし |
| 2 | [通報画面UI（SC-11、対象別の理由選択肢出し分け）](02-report-screen-ui.md) | 1 |
| 3 | [通報作成 Route Handler（重複通報防止）](03-report-creation-handler.md) | 1 |
| 4 | [通報のレート制限（1日20件）](04-report-rate-limiting.md) | 3 |
| 5 | [受入テスト（E2E）](05-acceptance-e2e.md) | 1〜4すべて |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
