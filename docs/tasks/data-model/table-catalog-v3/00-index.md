# v3.0 テーブル追加・変更（データテーブル一覧の整合性確保） — タスク分割

> 出典: [table-catalog.md](../../../user-stories/data-model/table-catalog.md)

要件定義書 v3.0 の 5.2・5.3 で追加・変更するテーブルを、機能ストーリーに先立ってまとめて定義する。Task 1〜4 は互いに独立して着手できる。Task 5 は全マイグレーション適用後に実施する。

v1 の Epic: #81（v1 の共有テーブル定義）

| # | タスク | 依存 |
|---|---|---|
| 1 | [posts の下書き列追加とカテゴリ 7 値への移行](01-posts-draft-category-migration.md) | なし |
| 2 | [itineraries・itinerary_spots テーブルと RLS](02-itineraries-tables.md) | なし |
| 3 | [itinerary_members・itinerary_invitations テーブルとオーナー継承への組み込み](03-itinerary-members-invitations.md) | Task 2 |
| 4 | [spot_status_reports テーブルと RLS](04-spot-status-reports-table.md) | なし |
| 5 | [rate_limits の action_type 追加と全マイグレーションの適用確認](05-rate-limit-actions-and-verification.md) | Task 1〜4 |
| 6 | [受入テスト（E2E）](06-acceptance-e2e.md) | Task 1〜5 すべて |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
