# Task 7: 招待・権限変更・削除の通知連携

> 出典: [album-collaboration.md](../../../user-stories/records/album-collaboration.md)
> インデックス: [album-collaboration](00-index.md)

## 依存

- [Task 4: 招待受諾処理（album_membersへの追加）](04-invitation-acceptance-handler.md)
- [Task 5: メンバーの権限変更・削除 Route Handler](05-member-role-management-handler.md)
- notification-triggers（[目次](../../notifications/notification-triggers/00-index.md)、通知作成の共通関数を提供するタスク）

## 実装内容

要件定義書3.9.1に定義された、以下3種類の通知トリガーを組み込む。

- アルバムへの参加（招待の受諾）：Task4の受諾処理内で、参加した本人・アルバムのオーナー・既存メンバー全員へ通知する
- 権限の変更：Task5の権限変更処理内で、変更されたメンバー本人へ通知する
- メンバーの削除：Task5の削除処理内で、削除されたメンバー本人へ通知する

いずれも`notification-triggers`（F-NT-01）で定義される共通の通知作成関数を呼び出す形で実装し、`notifications`テーブルへの直接INSERTは行わない。

## 成果物

- Task4・5の各処理への通知作成関数の呼び出し組み込み

## テスト要件

### 単体テスト
- 各トリガー発生時に、通知作成関数が正しい`type`・`related_id`・通知先ユーザーIDで呼び出されることを検証する

### 結合テスト
- テスト用DBで招待受諾を行い、参加者本人・オーナー・既存メンバーそれぞれに`notifications`レコードが作成されることを確認する
- 権限変更・削除それぞれで、対象メンバーに`notifications`レコードが作成されることを確認する

### E2Eテスト
- なし（[Task 8: 受入テスト（E2E）](08-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- なし（通知一覧への反映自体は要件定義書8章 No.29で検証される。本ストーリーでは通知作成の呼び出し組み込みが対象）
