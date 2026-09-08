# Task 3: 既読化処理・未読バッジ連携

> 出典: [notification-list.md](../../../user-stories/notifications/notification-list.md)
> インデックス: [notification-list](00-index.md)

## 依存

- [Task 2: 通知一覧画面UI（SC-14）](02-notification-list-ui.md)
- shared-ui/menu-bar [Task2: 通知未読件数バッジの表示](../../shared-ui/menu-bar/02-unread-notification-badge.md)（バッジ表示・未読件数取得APIは実装済み）

## 実装内容

- 通知一覧画面（SC-14）を開いた際、表示された個人向け通知（お知らせを除く）の`is_read`を`true`に更新するエンドポイント（例：`PATCH /api/notifications/read`）を実装し、画面表示時に呼び出す
- 既読化後、shared-ui/menu-barの未読件数バッジが再取得・更新されるようにする（バッジ側のAPI呼び出しをトリガーする、またはクライアント側の状態を連動させる）
- お知らせは既読管理の対象外とし、本処理の対象から除外する

## 成果物

- 既読化API（`PATCH /api/notifications/read`）
- 一覧画面表示時の既読化・バッジ更新トリガー実装

## テスト要件

### 単体テスト
- 既読化APIが個人向け通知のみを対象とし、`system_announcements`由来の項目には影響しないことを検証する

### 結合テスト
- テスト用DBで未読通知を作成し、一覧画面表示後に`is_read=true`へ更新され、未読件数取得APIの返り値が更新後の件数と一致することを確認する

### E2Eテスト
- なし（[Task 6: 受入テスト（E2E）](06-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 通知一覧を開くと、表示された個人向け通知が既読になり、メニューバーの未読件数バッジが更新されること
- お知らせは既読管理の対象外として常に表示され、未読件数の集計に含まれないこと
