# F-AC-01 サインアップ・ログイン — タスク分割

> 出典: [signup-login.md](../../../user-stories/account/signup-login.md)

各タスクの詳細・テスト要件は個別ファイルを参照。依存関係の都合上、Task 1・2が土台、Task 3・4・5・7・8はある程度並行して着手できる（Task 4は1・2に依存、Task 5・7・8は4に依存）。Task 9は全体の結合後に実施する。IdPはGoogleのみのため、複数IdP連携タスクは対象外。

| # | タスク | 依存 |
|---|---|---|
| 1 | [Supabase Auth OAuthプロバイダ設定](01-oauth-provider-setup.md) | なし |
| 2 | [users テーブルのスキーマ定義・マイグレーション](02-users-table-migration.md) | なし |
| 3 | [ログイン画面UI（SC-01）](03-login-screen-ui.md) | 1 |
| 4 | [OAuthコールバック Route Handler](04-oauth-callback-handler.md) | 1, 2 |
| 5 | [初回ログイン時のユーザーレコード作成ロジック](05-initial-user-record-creation.md) | 4 |
| 7 | [利用規約・プライバシーポリシー同意フロー](07-consent-flow.md) | 4, 5 |
| 8 | [ログイン試行のレート制限](08-login-rate-limiting.md) | 2, 4 |
| 9 | [受入テスト（E2E）](09-acceptance-e2e.md) | 1, 2, 3, 4, 5, 7, 8すべて |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
