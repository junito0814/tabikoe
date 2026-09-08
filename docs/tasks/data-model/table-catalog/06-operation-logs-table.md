# Task 6: operation_logs テーブルのスキーマ定義・マイグレーション

> 出典: [table-catalog.md](../../../user-stories/data-model/table-catalog.md)、[requirement.md](../../../requirement.md) 7.5
> インデックス: [table-catalog](00-index.md)

## 依存

- [Task1: users テーブルのスキーマ定義・マイグレーション](../../account/signup-login/02-users-table-migration.md)（`user_id`のFK先）

## 実装内容

要件定義書5.2・7.5に準拠し、`operation_logs`テーブルを作成する。対象操作はログイン成功／失敗、投稿の作成・編集・削除、コメントの投稿・削除、通報、アカウントの登録・退会、管理者による対応操作の横断的な監査ログであり、単一の機能カテゴリに属さないため、テーブル定義の欠落を補う本ストーリーで定義する。

- カラム：`id`, `user_id`（FK→`users.id`、ログイン失敗等ユーザー未確定の操作は`NULL`許容）, `action_type`（列挙：`login_success`／`login_failure`／`post_create`／`post_update`／`post_delete`／`comment_create`／`comment_delete`／`report_create`／`account_create`／`account_delete`／`admin_action`等）, `target_id`（対象レコードのID、任意）, `detail`（付随情報、任意のJSON等）, `created_at`
- 保存期間90日（7.5準拠）。物理削除するバッチ処理の要否は本タスクでは扱わず、運用上の課題として9章に準じた未決定事項として扱う
- 閲覧権限は管理者のみ（`is_admin`判定はアプリケーション層で行い、テーブル自体にRLSを設定する場合は`is_admin`参照ポリシーとする）
- 書き込みは各機能のRoute Handlersが操作完了時に共通ヘルパー経由でINSERTする想定（5.3の「共通関数として切り出す」方針に準拠）。書き込みの呼び出し組み込み自体は各機能ストーリー（アカウント管理・投稿・コメント・通報・管理者機能）側のタスクとし、本タスクはテーブル定義と共通書き込みヘルパーの提供のみを対象とする

## 成果物

- マイグレーションファイル
- 共通ログ書き込みヘルパー関数（各Route Handlersから呼び出す想定のインターフェース定義）

## テスト要件

### 単体テスト
- ヘルパー関数が想定どおりのカラムでINSERT用のレコードを組み立てることを検証する
- `user_id`がNULL（未認証操作）のケースでもエラーにならないことを検証する

### 結合テスト
- Supabaseローカル環境でマイグレーションが冪等に適用できることを確認する
- ヘルパー関数を通じて実際に`operation_logs`へレコードが記録されることを確認する

### E2Eテスト
- なし（本タスクは横断的な基盤整備であり、個別機能への組み込みは各機能ストーリーの受入テストでカバーする）

## 関連する受入条件

- 既存タスクが参照するテーブル（operation_logs等）すべてにスキーマ定義（マイグレーション）が存在すること
