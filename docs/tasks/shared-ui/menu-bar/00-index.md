# 共通メニューバー — タスク分割

> 出典: [menu-bar.md](../../../user-stories/shared-ui/menu-bar.md)

各タスクの詳細・テスト要件は個別ファイルを参照。Task 1が土台。Task 2・3はTask 1完了後に並行して着手できる。Task 4は全体の結合後に実施する。

| # | タスク | 依存 |
|---|---|---|
| 1 | [共通メニューバーコンポーネントの実装](01-menu-bar-component.md) | F-AC-02 Task1 |
| 2 | [通知未読件数バッジの表示](02-unread-notification-badge.md) | 1 |
| 3 | [管理画面への導線制御（is_admin判定）](03-admin-access-control.md) | 1, F-AC-04 |
| 4 | [受入テスト（E2E）](04-acceptance-e2e.md) | 1〜3すべて |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
