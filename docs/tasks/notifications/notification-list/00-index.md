# 通知一覧画面 — タスク分割

> 出典: [notification-list.md](../../../user-stories/notifications/notification-list.md)

各タスクの詳細・テスト要件は個別ファイルを参照。Task 1が土台、Task 2はTask 1に依存、Task 3・4はTask 2に依存し並行着手できる。Task 5はTask 1に依存。Task 6は全体の結合後に実施する。未読件数バッジの表示・取得APIは[shared-ui/menu-bar Task2](../../shared-ui/menu-bar/02-unread-notification-badge.md)で実装済みのため、本ストーリーでは既読化に伴うバッジ更新の連携のみを扱う。

| # | タスク | 依存 |
|---|---|---|
| 1 | [通知一覧取得API（notifications・system_announcements統合、ページング）](01-notification-list-api.md) | table-catalog Task3 |
| 2 | [通知一覧画面UI（SC-14）](02-notification-list-ui.md) | 1 |
| 3 | [既読化処理・未読バッジ連携](03-read-status-badge-sync.md) | 2, shared-ui/menu-bar Task2 |
| 4 | [通知タップ時の画面遷移マッピング](04-notification-tap-navigation.md) | 2 |
| 5 | [90日保存期間の除外ロジック](05-retention-cutoff.md) | 1 |
| 6 | [受入テスト（E2E）](06-acceptance-e2e.md) | 1〜5すべて |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
