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

## 書き込みの組み込み状況

「書き込みの呼び出し組み込みは各機能ストーリー側のタスク」としているが、実際にはどの機能ストーリーのタスクファイルにも含まれていなかった。そのため、実装済みのRoute Handlerへの組み込みは本タスクの延長として行い、ここに一覧を置く。**未実装の機能を実装する際は、該当行の組み込みも同じPRで行うこと。**

| 対象操作（7.5） | `action_type` | 組み込み先 | 状態 |
|---|---|---|---|
| ログイン成功 | `login_success` | `/api/auth/callback` | 済 |
| ログイン失敗 | `login_failure` | `/api/auth/callback`（コード交換失敗・未登録・同意なし） | 済 |
| 投稿の作成 | `post_create` | `POST /api/posts` | 済 |
| 投稿の編集 | `post_update` | `PATCH /api/posts/[id]` | 済 |
| 投稿の削除 | `post_delete` | `DELETE /api/posts/[id]` | 済 |
| アカウントの登録 | `account_create` | `/api/auth/callback`（初回サインアップ時） | 済 |
| アカウントの退会 | `account_delete` | `POST /api/users/me/deactivate` | 済 |
| コメントの投稿・削除 | `comment_create` / `comment_delete` | `POST /api/posts/[id]/comments` / `DELETE /api/comments/[id]` | 済 |
| 通報 | `report_create` | `POST /api/reports` | 済 |
| 管理者による対応操作 | `admin_action` | F-AD-05（Phase 8） | 未実装の機能 |

`detail` には個人情報・認証情報を入れない。ログイン失敗時のIPアドレスはレート制限（F-AC-01 Task8）と同じ粒度の運用情報として記録する。

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
