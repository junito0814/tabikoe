# Task 2: 通知種別カタログの定義（3.9.1準拠）

> 出典: [notification-triggers.md](../../../user-stories/notifications/notification-triggers.md)
> インデックス: [notification-triggers](00-index.md)

## 依存

- [Task 1: 通知作成共通関数の実装](01-notification-helper.md)

## 実装内容

- 3.9.1表の8種類の通知について、`type`値・`related_id`が指す対象・通知先の決定ルールを一覧化したカタログ（コード内定数またはドキュメント表）を定義する

| type | related_idの対象 | 通知先 | 発生元（担当ストーリー） |
|---|---|---|---|
| comment | コメントID | 投稿者本人 | browsing/comments |
| like | いいねID または 投稿ID | 投稿者本人 | browsing/likes |
| album_join | trip_id | 参加した本人・オーナー・既存メンバー | records/album-collaboration |
| role_change | trip_id | 権限を変更されたメンバー本人 | records/album-collaboration |
| member_removed | trip_id | 削除されたメンバー本人 | records/album-collaboration |
| new_owner | trip_id | 新オーナーに選出された本人 | account/account-deletion（実装済み） |
| report_resolved | report_id | 通報した本人（「削除」対応時のみ） | admin/report-handling |

（運営お知らせは`notifications`ではなく`system_announcements`を使うため本カタログの対象外。[notification-list](../notification-list/00-index.md)側で読み取り時に合流する）

- 各担当ストーリーは、このカタログに定義された`type`・`related_id`規則に従ってTask1の共通関数を呼び出す

## 成果物

- 通知種別カタログ（型定義またはドキュメント）

## テスト要件

### 単体テスト
- カタログに定義された`type`値が、共通関数の受け付ける値と一致することを検証する（型チェックまたはバリデーション）

### 結合テスト
- なし（各担当ストーリー側の結合テストでカタログ準拠を確認する）

### E2Eテスト
- なし（[Task 3: 受入テスト](03-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 運営からのお知らせは、`notifications`ではなく`system_announcements`へ1件のみ記録され、ユーザーごとに複製されないこと
