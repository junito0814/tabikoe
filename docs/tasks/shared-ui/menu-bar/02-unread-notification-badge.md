# Task 2: 通知未読件数バッジの表示

> 出典: [menu-bar.md](../../../user-stories/shared-ui/menu-bar.md)
> インデックス: [menu-bar](00-index.md)

## 依存

- [Task 1: 共通メニューバーコンポーネントの実装](01-menu-bar-component.md)
- table-catalog [Task3: notifications テーブルのスキーマ定義・マイグレーション](../../data-model/table-catalog/03-notifications-table.md)

## 実装内容

- メニューバーの通知アイコンに、個人向け通知の未読件数（`notifications.is_read = false`の件数）を取得して表示する（3.9.2 F-NT-02準拠）
- 未読件数取得エンドポイント（例：`GET /api/notifications/unread-count`）を実装する
- 未読件数が0件の場合はバッジを非表示にする

## 成果物

- 未読件数取得API
- バッジ表示コンポーネント

## テスト要件

### 単体テスト
- 未読件数0件時にバッジが非表示になり、1件以上で表示されることを検証する

### 結合テスト
- テスト用DBで未読通知を複数件作成し、実際の件数が正しく取得・表示されることを確認する

### E2Eテスト
- なし（[Task 4: 受入テスト（E2E）](04-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 通知アイコンに未読件数バッジが表示されること
