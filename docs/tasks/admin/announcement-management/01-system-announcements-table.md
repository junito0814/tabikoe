# Task 1: system_announcements テーブルのスキーマ定義・マイグレーション

> 出典: [announcement-management.md](../../../user-stories/admin/announcement-management.md)
> インデックス: [announcement-management](00-index.md)

## 依存

なし（土台タスク）

## 実装内容

要件定義書5.2・3.10.3に準拠し、`system_announcements`テーブルを作成する。

- カラム：`id`, `title`（100文字まで）, `body`（2,000文字まで）, `published_at`, `created_at`, `updated_at`
- ユーザーごとの複製は行わない（1件のレコードが全ユーザーに配信される）ため、`user_id`等の宛先カラムは持たない
- 通知一覧（F-NT-02）からの読み取り専用アクセスと、管理画面（本ストーリー）からの作成・編集・削除アクセスの双方を想定したRLSポリシーを設定する（ログイン済み全ユーザーがSELECT可、`is_admin`のみがINSERT/UPDATE/DELETE可）

## 成果物

- マイグレーションファイル
- RLSポリシー定義

## テスト要件

### 単体テスト
- 対象外（DDL・ポリシー定義のため下記の結合テストでカバーする）

### 結合テスト
- Supabaseローカル環境でマイグレーションが冪等に適用できることを確認する
- 一般ユーザーのセッションでSELECTができ、INSERT/UPDATE/DELETEが拒否されることを確認する
- `is_admin=true`のユーザーのセッションでINSERT/UPDATE/DELETEができることを確認する

### E2Eテスト
- なし（本タスクは画面を持たないため）

## 関連する受入条件

- なし（後続タスクの基盤となるスキーマ定義）
