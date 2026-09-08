# F-RC-03 アルバムの共同編集・招待 — タスク分割

> 出典: [album-collaboration.md](../../../user-stories/records/album-collaboration.md)

各タスクの詳細・テスト要件は個別ファイルを参照。Task 1が土台。Task 2・3はTask 1に依存し並行着手できる。Task 4はTask 2に依存。Task 5・6はTask 1に依存し並行着手できる。Task 7はTask 4・5・6に依存。Task 8は全体の結合後に実施する。

`album_members`テーブルは[table-catalog](../../data-model/table-catalog/00-index.md) Task2で定義済み。オーナー継承ルール（3.6.3）は[account-deletion](../../account/account-deletion/00-index.md) Task2で実装済みのため、本ストーリーの対象外。`album_invitations`テーブル（要件定義書5.2）はどのストーリーからも定義されていなかったため、Task1として本ストーリーで新規に定義する。

| # | タスク | 依存 |
|---|---|---|
| 1 | [album_invitations テーブルのスキーマ定義・マイグレーション](01-album-invitations-table-migration.md) | table-catalog Task2 |
| 2 | [招待リンク発行 Route Handler](02-invitation-issue-handler.md) | 1 |
| 3 | [招待リンクの手動無効化 Route Handler](03-invitation-revoke-handler.md) | 1 |
| 4 | [招待受諾処理（album_membersへの追加）](04-invitation-acceptance-handler.md) | 2 |
| 5 | [メンバーの権限変更・削除 Route Handler](05-member-role-management-handler.md) | 1 |
| 6 | [メンバーの自主退出機能](06-member-self-removal-handler.md) | 1 |
| 7 | [招待・権限変更・削除の通知連携](07-notification-integration.md) | 4, 5 |
| 8 | [受入テスト（E2E）](08-acceptance-e2e.md) | 1〜7すべて |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
