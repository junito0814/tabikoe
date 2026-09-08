# データテーブル一覧の整合性確保

> 出典: [requirement.md](../../requirement.md) 5.2

## ユーザーストーリー

開発者として、システム全体で共有されるデータテーブルが要件定義書5.2の一覧と一致するスキーマとして定義されていることを保証したい。なぜなら、機能ごとに個別実装すると、既に実装済みの機能（退会処理・通知バッジ・バッジ保持回帰テスト等）が参照しているテーブルが実際には存在しない、という不整合が生じるから。

## 詳細

5.2に列挙された17テーブルの実装状況は以下のとおり。

| テーブル名 | 概要 | 実装状況 |
|---|---|---|
| users | ユーザー情報。idp_provider・idp_subject・is_adminを保持する | 実装済み（[F-AC-01 Task2](../../tasks/account/signup-login/02-users-table-migration.md)） |
| trips | 旅行（旅行ID・旅行タイトル） | 実装済み（[F-PO-01 Task1](../../tasks/posts/post-creation/01-post-schema-migration.md)） |
| spots | スポット（Google Places由来・手動登録の双方） | 実装済み（[F-PO-01 Task1](../../tasks/posts/post-creation/01-post-schema-migration.md)） |
| posts | 投稿。costは整数型・1人あたりの金額として保持する | 実装済み（[F-PO-01 Task1](../../tasks/posts/post-creation/01-post-schema-migration.md)） |
| post_photos | 投稿に紐づく写真・動画 | 実装済み（[F-PO-01 Task1](../../tasks/posts/post-creation/01-post-schema-migration.md)・[Task4](../../tasks/posts/post-creation/04-media-upload-integration.md)） |
| rate_limits | レート制限のカウント | **未定義**（F-AC-01 Task8・F-PO-01 Task5が参照しているが、スキーマ定義タスクが存在しなかった）→本ストーリーの[Task1](../../tasks/data-model/table-catalog/01-rate-limits-table.md)で新規定義 |
| album_members | アルバムのメンバーと権限 | **未定義**（F-AC-05 Task2が参照しているが、スキーマ定義タスクが存在しなかった）→[Task2](../../tasks/data-model/table-catalog/02-album-members-table.md)で新規定義 |
| notifications | 個人向け通知 | **未定義**（F-AC-05 Task2・menu-bar Task2が参照しているが、スキーマ定義タスクが存在しなかった）→[Task3](../../tasks/data-model/table-catalog/03-notifications-table.md)で新規定義 |
| badges | 獲得済みバッジ | **未定義**（F-PO-03 Task3が参照しているが、スキーマ定義タスクが存在しなかった）→[Task4](../../tasks/data-model/table-catalog/04-badges-table.md)で新規定義 |
| comments | コメント | **未定義**（F-AC-05 Task1が参照しているが、スキーマ定義タスクが存在しなかった）→[Task5](../../tasks/data-model/table-catalog/05-interaction-tables.md)で新規定義 |
| likes | いいね | 同上→[Task5](../../tasks/data-model/table-catalog/05-interaction-tables.md) |
| wishlist | 「行きたい」保存 | 同上→[Task5](../../tasks/data-model/table-catalog/05-interaction-tables.md) |
| blocks | ブロック関係 | 同上→[Task5](../../tasks/data-model/table-catalog/05-interaction-tables.md) |
| album_invitations | 招待リンクのトークン・付与する権限・有効期限 | 実装済み（[F-RC-03 Task1](../../tasks/records/album-collaboration/01-album-invitations-table-migration.md)、機能ストーリー側で自ら定義） |
| reports | 通報 | 実装済み（[F-SF-01 Task1](../../tasks/safety/reporting/01-reports-schema-migration.md)、機能ストーリー側で自ら定義） |
| operation_logs | 操作ログ | 実装済み（[本ストーリー Task6](../../tasks/data-model/table-catalog/06-operation-logs-table.md)） |
| system_announcements | 運営からのお知らせ | 実装済み（[F-AD-03 Task1](../../tasks/admin/announcement-management/01-system-announcements-table.md)、機能ストーリー側で自ら定義） |

## 受入条件

- [ ] 既存タスクが参照するテーブル（rate_limits, album_members, notifications, badges, comments, likes, wishlist, blocks, operation_logs）すべてにスキーマ定義（マイグレーション）が存在すること
- [ ] 新規定義したテーブルに対し、既存タスク（F-AC-05, F-PO-03, menu-bar）の結合テストが実際のスキーマに対して実行でき、成功すること
- [ ] album_invitations・reports・system_announcementsは、それぞれの機能ストーリー（F-RC-03・F-SF-01・F-AD-03）側でスキーマ定義が完了していること
