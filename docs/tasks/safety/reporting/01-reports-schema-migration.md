# Task 1: reports テーブルのスキーマ定義・マイグレーション

> 出典: [reporting.md](../../../user-stories/safety/reporting.md)
> インデックス: [reporting](00-index.md)

## 依存

なし（土台タスク。data-model/table-catalog では未定義のテーブルのため、本ストーリーで自前に定義する）

## 実装内容

要件定義書5.2・3.8.1に準拠し、`reports`テーブルを作成する。

- `id`, `reporter_id`（FK→`users.id`）
- `target_type`（`post`／`post_photo`／`post_review`／`comment`／`user`／`spot`／`trip`の7種別のいずれか。対象テーブルがそれぞれ異なるため、DBレベルのFKは張らずアプリケーション層で整合性を担保するポリモーフィック関連とする）
- `target_id`（対象のUUID。`target_type`に応じて参照先テーブルが変わる）
- `reason`（`inappropriate`／`personal_info`／`false_info`／`copyright`／`spam`／`impersonation`／`wrong_spot_info`／`other`。`impersonation`は`target_type='user'`、`wrong_spot_info`は`target_type='spot'`の場合のみ許容し、アプリ層でバリデーションする）
- `detail`（自由記述、1,000文字まで、任意）
- `status`（`unconfirmed`／`in_review`／`resolved_hidden`／`resolved_deleted`／`no_issue`。デフォルト`unconfirmed`）
- `resolved_by`（FK→`users.id`、任意、対応した管理者）
- `resolved_at`（任意）
- `resolution_note`（対応理由メモ、任意）
- `created_at`
- `(reporter_id, target_type, target_id)`に一意制約（重複通報防止）

## 成果物

- マイグレーションファイル

## テスト要件

### 単体テスト
- 対象外（DDLのため下記の結合テストでカバーする）

### 結合テスト
- Supabaseローカル環境でマイグレーションが冪等に適用できることを確認する
- `(reporter_id, target_type, target_id)`の一意制約により、同一ユーザーが同一対象へ重複INSERTした場合にエラーとなることを確認する
- `reason='impersonation'`かつ`target_type!='user'`、または`reason='wrong_spot_info'`かつ`target_type!='spot'`のレコードをアプリ層のバリデーションが拒否することを確認する（DB制約ではなくアプリ層で担保する場合はその旨を明記する）

### E2Eテスト
- なし（本タスクは画面を持たないため）

## 関連する受入条件

- 同一ユーザーが同一対象に重複して通報できないこと
