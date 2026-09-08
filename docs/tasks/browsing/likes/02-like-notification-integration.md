# Task 2: いいね通知の送信統合

> 出典: [likes.md](../../../user-stories/browsing/likes.md)、[requirement.md](../../../requirement.md) 3.9.1
> インデックス: [likes](00-index.md)

## 依存

- [Task 1: いいね付与・取り消し Route Handler](01-like-toggle-handler.md)
- notifications カテゴリ（別途作成）の通知作成共通処理（[notification-triggers](../../notifications/notification-triggers/00-index.md)）

## 実装内容

- いいね付与時、投稿者（自分自身によるいいねを除く）に対して`notifications`テーブルへの通知レコードを1件作成する
- 通知の作成自体はnotificationsカテゴリで定義される共通関数を呼び出す形で実装し、本タスクではいいね付与処理からの呼び出し統合のみを行う
- いいねの取り消し時は通知を削除しない（取り消しに対する通知アクションは行わない）

## 成果物

- いいね付与処理（Task1）への通知呼び出しの組み込み

## テスト要件

### 単体テスト
- 自分以外のユーザーの投稿にいいねした場合、投稿者への通知が1件作成されることを検証する
- 自分自身の投稿にいいねした場合、通知が作成されないことを検証する

### 結合テスト
- テスト用DBで、いいね付与処理の実行後に`notifications`テーブルへ正しくレコードが作成されることを確認する

### E2Eテスト
- なし（[Task 4: 受入テスト（E2E）](04-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- いいねが付与されると、投稿者（自分自身によるいいねを除く）に通知が送られること
