# Task 1: 通知作成共通関数の実装

> 出典: [notification-triggers.md](../../../user-stories/notifications/notification-triggers.md)
> インデックス: [notification-triggers](00-index.md)

## 依存

- table-catalog [Task3: notifications テーブルのスキーマ定義・マイグレーション](../../data-model/table-catalog/03-notifications-table.md)

## 実装内容

- 各機能のRoute Handlersから呼び出す共通関数（例：`createNotification({ userId, type, relatedId })`）を実装する（7.6準拠、通知送信ロジックの重複実装を避ける）
- 行為者本人と通知先が同一の場合は何もしない（自分自身の操作を除く、3.9.1準拠）ガードをこの関数内に持たせ、呼び出し側での個別実装を不要にする
- 内部で`notifications`テーブルへ`user_id`, `type`, `related_id`, `is_read=false`, `created_at`をINSERTする

## 成果物

- 通知作成共通関数（サーバー側共通モジュール）

## テスト要件

### 単体テスト
- 正常系：関数呼び出しで`notifications`に想定どおりのレコードが作成されることを検証する
- 行為者本人＝通知先の場合、INSERTが行われないことを検証する

### 結合テスト
- テスト用DBに対して実際に呼び出し、レコードが永続化されることを確認する

### E2Eテスト
- なし（[Task 3: 受入テスト](03-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 各機能のRoute Handlerが、共通の通知作成関数を通じて`notifications`へ書き込む構成になっていること
- コメント・いいね・アルバム参加・権限変更・メンバー削除・新オーナー選出のいずれについても、行為者本人には通知が作成されないこと
