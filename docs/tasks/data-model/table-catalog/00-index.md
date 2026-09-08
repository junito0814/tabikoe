# データテーブル一覧の整合性確保 — タスク分割

> 出典: [table-catalog.md](../../../user-stories/data-model/table-catalog.md)

各タスクの詳細・テスト要件は個別ファイルを参照。Task 1〜6は互いに独立しており並行着手できる（それぞれ`users`・`trips`・`posts`・`spots`という既存テーブルへのFKにのみ依存）。Task 7は全体の結合後に実施する。

本ストーリーは新規機能ではなく、既に実装済みのタスク（F-AC-01, F-PO-01, F-AC-05, F-PO-03, menu-bar）が参照しているにもかかわらずスキーマ定義が存在しなかったテーブルを補うものである。なお、`album_invitations`（records/album-collaboration）・`reports`（safety/reporting）・`system_announcements`（admin/announcement-management）は、各機能ストーリー側で自ら定義したため本ストーリーの対象外である（詳細は[table-catalog.md](../../../user-stories/data-model/table-catalog.md)参照）。

| # | タスク | 依存 |
|---|---|---|
| 1 | [rate_limits テーブルのスキーマ定義・マイグレーション](01-rate-limits-table.md) | なし |
| 2 | [album_members テーブルのスキーマ定義・マイグレーション](02-album-members-table.md) | post-creation Task1, signup-login Task2 |
| 3 | [notifications テーブルのスキーマ定義・マイグレーション](03-notifications-table.md) | signup-login Task2 |
| 4 | [badges テーブルのスキーマ定義・マイグレーション](04-badges-table.md) | signup-login Task2 |
| 5 | [対話系テーブル（comments・likes・wishlist・blocks）のスキーマ定義・マイグレーション](05-interaction-tables.md) | signup-login Task2, post-creation Task1 |
| 6 | [operation_logs テーブルのスキーマ定義・マイグレーション](06-operation-logs-table.md) | signup-login Task2 |
| 7 | [既存タスクの結合検証（回帰確認）](07-regression-verification.md) | 1〜6すべて |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
