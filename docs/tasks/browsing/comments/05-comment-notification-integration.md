# Task 5: コメント通知の送信統合

> 出典: [comments.md](../../../user-stories/browsing/comments.md)、[requirement.md](../../../requirement.md) 3.9.1
> インデックス: [comments](00-index.md)

## 依存

- [Task 1: コメント投稿 Route Handler（バリデーション・エスケープ処理）](01-comment-create-handler.md)
- notifications カテゴリ（別途作成）の通知作成共通処理（[notification-triggers](../../notifications/notification-triggers/00-index.md)）

## 実装内容

- コメント投稿時、投稿者（自分自身のコメントを除く）に対して`notifications`テーブルへの通知レコードを1件作成する
- 通知の作成自体はnotificationsカテゴリで定義される共通関数を呼び出す形で実装し、本タスクではコメント投稿処理からの呼び出し統合のみを行う
- コメント削除時は通知を削除しない

## 成果物

- コメント投稿処理（Task1）への通知呼び出しの組み込み

## テスト要件

### 単体テスト
- 自分以外のユーザーの投稿にコメントした場合、投稿者への通知が1件作成されることを検証する
- 自分自身の投稿にコメントした場合、通知が作成されないことを検証する

### 結合テスト
- テスト用DBで、コメント投稿処理の実行後に`notifications`テーブルへ正しくレコードが作成されることを確認する

### E2Eテスト
- なし（[Task 7: 受入テスト（E2E）](07-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- コメントが投稿されると、投稿者（自分自身のコメントを除く）に通知が送られること
