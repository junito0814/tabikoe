# データテーブル一覧の整合性確保

> 出典: [requirement.md](../../requirement.md) 5.2（v3.0で追加テーブルを追記）

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

v3.0（要件定義書 5.2・5.3）で追加・変更するテーブル。定義は各機能ストーリーのタスクで行い、本表で追跡する。

| テーブル名 | 概要 | 担当ストーリー |
|---|---|---|
| posts（変更） | status（draft／published）・lat・lng・published_at を追加。draft は spot_id・category・stay_time・rating・visited_at が NULL 可（CHECK は published のときだけ必須項目を検証）。category の CHECK を 7 値に更新し「イベント会場」→「エンタメ・イベント」へ一括更新 | [posts/draft](../posts/draft.md)、[posts/post-creation](../posts/post-creation.md) |
| itineraries | しおり。trip_id（trips と 1 対 1、UNIQUE）・start_date・end_date（NULL 可）・updated_at | [itinerary/itinerary-basics](../itinerary/itinerary-basics.md) |
| itinerary_spots | itinerary_id・spot_id（組で UNIQUE）・day_index（NULL＝未定）・arrival_time（NULL 可）・sort_order・memo・checked_at・checked_by | [itinerary/itinerary-days](../itinerary/itinerary-days.md) |
| itinerary_members | しおりのメンバーと権限（owner／member）・joined_at | [itinerary/itinerary-sharing](../itinerary/itinerary-sharing.md) |
| itinerary_invitations | 招待リンクのトークン・有効期限（album_invitations と同じ構造） | [itinerary/itinerary-sharing](../itinerary/itinerary-sharing.md) |
| spot_status_reports | spot_id・user_id（組で UNIQUE）・status（still_there／gone）・reported_at | [browsing/spot-status-report](../browsing/spot-status-report.md) |
| rate_limits（変更なし） | action_type に itinerary_invite・draft_save・spot_status_report を追加して使う | 各ストーリー |

いずれも RLS を有効にし、下書き・しおりは本人／メンバー以外が参照できないポリシーを持つ。

## 受入条件

- [ ] 既存タスクが参照するテーブル（rate_limits, album_members, notifications, badges, comments, likes, wishlist, blocks, operation_logs）すべてにスキーマ定義（マイグレーション）が存在すること
- [ ] 新規定義したテーブルに対し、既存タスク（F-AC-05, F-PO-03, menu-bar）の結合テストが実際のスキーマに対して実行でき、成功すること
- [ ] album_invitations・reports・system_announcementsは、それぞれの機能ストーリー（F-RC-03・F-SF-01・F-AD-03）側でスキーマ定義が完了していること
- [ ] v3.0 で追加・変更するテーブル（posts の列追加と category 移行、itineraries、itinerary_spots、itinerary_members、itinerary_invitations、spot_status_reports）にマイグレーションと RLS ポリシーが存在し、下書き・しおりが本人／メンバー以外から参照できないこと
