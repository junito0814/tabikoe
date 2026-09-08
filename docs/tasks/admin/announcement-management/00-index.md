# F-AD-03 お知らせ管理 — タスク分割

> 出典: [announcement-management.md](../../../user-stories/admin/announcement-management.md)

各タスクの詳細・テスト要件は個別ファイルを参照。Task 1が土台、Task 2はTask 1に依存、Task 3はTask 2に依存する。Task 4は全体の結合後に実施する。通知一覧画面での表示（読み取り側のマージ）はnotification-list（F-NT-02）の範囲であり、本ストーリーには含まない。

| # | タスク | 依存 |
|---|---|---|
| 1 | [system_announcements テーブルのスキーマ定義・マイグレーション](01-system-announcements-table.md) | なし |
| 2 | [お知らせ作成・編集・削除 Route Handler](02-announcement-crud-handler.md) | 1, admin-login Task1 |
| 3 | [お知らせ管理画面UI（SC-17）](03-announcement-management-ui.md) | 2 |
| 4 | [受入テスト（E2E）](04-acceptance-e2e.md) | 1〜3すべて |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
