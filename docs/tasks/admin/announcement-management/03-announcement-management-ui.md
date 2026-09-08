# Task 3: お知らせ管理画面UI（SC-17）

> 出典: [announcement-management.md](../../../user-stories/admin/announcement-management.md)
> インデックス: [announcement-management](00-index.md)

## 依存

- [Task 2: お知らせ作成・編集・削除 Route Handler](02-announcement-crud-handler.md)

## 実装内容

- お知らせ管理画面（SC-17）を実装する：既存お知らせの一覧表示、新規作成フォーム（タイトル・本文・公開日時）、既存お知らせの編集・削除操作
- 管理者ダッシュボード（SC-16）からの遷移導線に対応する

## 成果物

- `app/admin/announcements/page.tsx`

## テスト要件

### 単体テスト
- 文字数超過時にフォームが送信をブロックし、エラー表示を行うことを検証する

### 結合テスト
- テスト用DBに対して画面から作成・編集・削除操作を行い、Task2のRoute Handlerが正しく呼び出されることを確認する

### E2Eテスト
- なし（[Task 4: 受入テスト（E2E）](04-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 管理者ダッシュボード（SC-16）からお知らせ管理画面（SC-17）へ遷移できること
