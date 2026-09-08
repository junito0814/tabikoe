# Task 1: 通知一覧取得API（notifications・system_announcements統合、ページング）

> 出典: [notification-list.md](../../../user-stories/notifications/notification-list.md)
> インデックス: [notification-list](00-index.md)

## 依存

- table-catalog [Task3: notifications テーブルのスキーマ定義・マイグレーション](../../data-model/table-catalog/03-notifications-table.md)

## 実装内容

- ログインユーザー自身の`notifications`と、全ユーザー共通の`system_announcements`を取得し、`created_at`（お知らせは`published_at`）で新着順にマージして返すエンドポイント（例：`GET /api/notifications`）を実装する
- レスポンスの各項目に種別（個人通知／お知らせ）を判別できるフィールドを付与する
- 1回につき20件を返し、カーソルまたはオフセットによる追加読み込みに対応する

## 成果物

- `app/api/notifications/route.ts`

## テスト要件

### 単体テスト
- `notifications`と`system_announcements`が正しくマージ・新着順ソートされることを検証する
- ページングパラメータに応じて20件区切りで返されることを検証する

### 結合テスト
- テスト用DBで個人通知・お知らせを混在させ、実際のAPIレスポンスが期待どおりの統合結果になることを確認する

### E2Eテスト
- なし（[Task 6: 受入テスト（E2E）](06-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 個人向け通知とお知らせが新着順に統合表示され、お知らせに種別ラベルが付与されること
- 1回につき20件を読み込み、スクロールに応じて追加読み込みされること
