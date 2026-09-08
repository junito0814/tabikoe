# Task 4: 受入テスト（E2E）

> 出典: [announcement-management.md](../../../user-stories/admin/announcement-management.md)
> インデックス: [announcement-management](00-index.md)

## 依存

- [Task 1: system_announcements テーブルのスキーマ定義・マイグレーション](01-system-announcements-table.md)
- [Task 2: お知らせ作成・編集・削除 Route Handler](02-announcement-crud-handler.md)
- [Task 3: お知らせ管理画面UI（SC-17）](03-announcement-management-ui.md)

## 実装内容

- 本ストーリーの受入条件4項目のうち、本ストーリーの範囲（作成・編集・削除、書き込み側）を検証するE2Eシナリオを作成・実行する
- 通知一覧への表示自体はnotification-list（F-NT-02）の受入テストで検証するため、本タスクでは`system_announcements`への登録確認までを対象とする

## 成果物

- E2Eテストシナリオ（手動 or 自動、Playwright等）
- 検証結果の記録

## テスト要件

### 単体テスト
- 対象外（本タスクはE2E検証が主目的）

### 結合テスト
- 対象外（Task 1〜3で実施済み）

### E2Eテスト
以下のシナリオを実施する。

1. 管理者ダッシュボードからお知らせ管理画面に遷移し、タイトル・本文・公開日時を入力してお知らせを作成する
   - 保存が成功し、一覧に表示されること
2. 作成したお知らせを編集する
   - 変更内容が反映されること
3. 作成したお知らせを削除する
   - 一覧から消えること

## 関連する受入条件

- タイトル・本文・公開日時を入力してお知らせを保存すると、`system_announcements`に登録されること
- 配信済みのお知らせを編集・削除できること
- 管理者ダッシュボード（SC-16）からお知らせ管理画面（SC-17）へ遷移できること
