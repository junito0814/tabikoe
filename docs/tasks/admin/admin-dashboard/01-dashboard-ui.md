# Task 1: 管理者ダッシュボード画面（SC-16）の実装

> 出典: [admin-dashboard.md](../../../user-stories/admin/admin-dashboard.md)
> インデックス: [admin-dashboard](00-index.md)

## 依存

- admin-login [Task1: 管理画面ルートMiddlewareの実装（is_admin判定・404）](../../admin/admin-login/01-admin-route-middleware.md)

## 実装内容

- `/admin`（SC-16）に、「お知らせ管理」「通報一覧・対応」への遷移ボタンのみを配置した画面を実装する
- 件数サマリー等の集計表示は行わない（本リリース対象外）
- アクセス制御はTask1（Middleware）に委ね、本タスクでは画面表示のみを扱う

## 成果物

- `app/admin/page.tsx`（ダッシュボード画面）

## テスト要件

### 単体テスト
- 「お知らせ管理」ボタンの遷移先が`announcement-management`のURLであることを検証する
- 「通報一覧・対応」ボタンの遷移先が`report-list`のURLであることを検証する

### 結合テスト
- テスト用DBで`is_admin=true`のユーザーがダッシュボードを表示し、両ボタンから実際に各画面へ遷移できることを確認する

### E2Eテスト
- なし（[Task 2: 受入テスト（E2E）](02-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 管理者ダッシュボード（SC-16）に、お知らせ管理（SC-17）・通報一覧（SC-18）への遷移ボタンが表示されること
- 各ボタンから対応する画面へ正しく遷移できること
