# F-AD-05 通報対応操作 — タスク分割

> 出典: [report-handling.md](../../../user-stories/admin/report-handling.md)

各タスクの詳細・テスト要件は個別ファイルを参照。Task 1が土台、Task 2・3はTask 1に依存しつつ並行して着手できる。Task 4は全体の結合後に実施する。

| # | タスク | 依存 |
|---|---|---|
| 1 | [通報対応操作 Route Handler（非公開化／削除／問題なし）](01-report-action-handler.md) | report-list Task1 |
| 2 | [削除対応時の通知連携](02-notification-on-delete.md) | 1, notifications/notification-triggers Task1 |
| 3 | [通報対応UI（SC-18・対応操作部分）](03-report-action-ui.md) | 1 |
| 4 | [受入テスト（E2E）](04-acceptance-e2e.md) | 1〜3すべて |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
