# Task 4: 通知タップ時の画面遷移マッピング

> 出典: [notification-list.md](../../../user-stories/notifications/notification-list.md)
> インデックス: [notification-list](00-index.md)

## 依存

- [Task 2: 通知一覧画面UI（SC-14）](02-notification-list-ui.md)

## 実装内容

- [notification-triggers Task2](../notification-triggers/02-notification-catalog.md)の通知種別カタログに定義された`type`・`related_id`をもとに、タップ時の遷移先を決定するマッピングを実装する
  - `comment`／`like` → 対象投稿の投稿詳細画面
  - `album_join`／`role_change`／`member_removed`／`new_owner` → 対象アルバム画面
  - `report_resolved` → 対象投稿等の詳細画面（削除済みの場合は該当メッセージを表示）
  - お知らせ → お知らせの詳細表示（画面内モーダル等）

## 成果物

- 通知タップ時の遷移マッピング実装

## テスト要件

### 単体テスト
- 各`type`値に対して、想定した遷移先が解決されることを検証する
- 削除済み等、遷移先が存在しないケースのフォールバック表示を検証する

### 結合テスト
- 実データで各種別の通知をタップし、実際に該当画面へ遷移することを確認する

### E2Eテスト
- なし（[Task 6: 受入テスト（E2E）](06-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 通知の種類に応じて、タップ時に関連する画面へ遷移すること
