# Task 2: お知らせ作成・編集・削除 Route Handler

> 出典: [announcement-management.md](../../../user-stories/admin/announcement-management.md)
> インデックス: [announcement-management](00-index.md)

## 依存

- [Task 1: system_announcements テーブルのスキーマ定義・マイグレーション](01-system-announcements-table.md)
- admin-login [Task1: 管理画面ルートMiddlewareの実装（is_admin判定・404）](../../admin/admin-login/01-admin-route-middleware.md)

## 実装内容

- お知らせの作成（タイトル・本文・公開日時を受け取り`system_announcements`へINSERT）を実装する
- お知らせの編集（既存レコードのUPDATE）・削除（DELETE）を実装する
- タイトル100文字まで、本文2,000文字まで（書記素クラスタ単位）のバリデーションを行う
- `/admin`配下のためTask1のMiddlewareにより`is_admin`は既に検証済みであることを前提とする

## 成果物

- `app/api/admin/announcements/route.ts`（作成・一覧取得）
- `app/api/admin/announcements/[id]/route.ts`（編集・削除）

## テスト要件

### 単体テスト
- 正常系：タイトル・本文・公開日時を指定した作成リクエストで、レコードが正しく保存されることを検証する
- 異常系：タイトルが101文字、本文が2,001文字（書記素クラスタ単位）の場合に保存が拒否されることを検証する
- 編集・削除が指定したレコードにのみ作用することを検証する

### 結合テスト
- テスト用DBでお知らせを作成し、`system_announcements`に登録されることを確認する
- 作成したお知らせを編集・削除し、DB上の内容が正しく更新・削除されることを確認する

### E2Eテスト
- なし（[Task 4: 受入テスト（E2E）](04-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- タイトル・本文・公開日時を入力してお知らせを保存すると、`system_announcements`に登録されること
- 配信済みのお知らせを編集・削除できること
