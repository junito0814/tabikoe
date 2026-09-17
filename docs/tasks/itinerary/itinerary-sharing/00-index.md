# F-IT-07 しおりの共有・招待 — タスク分割

> 出典: [itinerary-sharing.md](../../../user-stories/itinerary/itinerary-sharing.md)

v1 のアルバム招待（`albums/invitations.ts`・`/invitations/[token]`・`InvitationAcceptScreen`）と同型で作る。Task 1 → 2 → 3。

| # | タスク | 依存 |
|---|---|---|
| 1 | [招待リンクの発行・無効化・受諾](01-invitation-api-and-accept.md) | table-catalog-v3 Task 3、table-catalog-v3 Task 5、itinerary-basics Task 1 |
| 2 | [メンバー管理・退出と通知](02-members-management-and-notifications.md) | Task 1 |
| 3 | [権限制御とアルバムメンバーとの分離・オーナー継承](03-permission-enforcement.md) | Task 2、table-catalog-v3 Task 3 |
| 4 | [受入テスト（E2E）](04-acceptance-e2e.md) | Task 1〜3 すべて |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
