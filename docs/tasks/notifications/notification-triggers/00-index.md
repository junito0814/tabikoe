# 通知の発生条件 — タスク分割

> 出典: [notification-triggers.md](../../../user-stories/notifications/notification-triggers.md)

各タスクの詳細・テスト要件は個別ファイルを参照。Task 1が土台、Task 2はTask 1に依存、Task 3は関連ストーリー（browsing/comments、browsing/likes、records/album-collaboration、admin/announcement-management、admin/report-handling）の結合後に実施する。新オーナー選出通知は[F-AC-05 Task2](../../account/account-deletion/02-album-owner-succession.md)で実装済みのため、本ストーリーのタスク対象外。

| # | タスク | 依存 |
|---|---|---|
| 1 | [通知作成共通関数の実装](01-notification-helper.md) | table-catalog Task3 |
| 2 | [通知種別カタログの定義（3.9.1準拠）](02-notification-catalog.md) | 1 |
| 3 | [受入テスト（E2E・結合確認）](03-acceptance-e2e.md) | 1, 2、および他ストーリーでの組み込み |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
