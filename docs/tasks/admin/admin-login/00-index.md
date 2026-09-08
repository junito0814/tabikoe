# F-AD-01 管理者ログイン — タスク分割

> 出典: [admin-login.md](../../../user-stories/admin/admin-login.md)

各タスクの詳細・テスト要件は個別ファイルを参照。Task 1が土台、Task 2はTask 1に依存する。Task 3は全体の結合後に実施する。認証方式自体（Google OAuth）・`is_admin`カラムはF-AC-01で既に実装済みのため、本ストーリーでは扱わない。

| # | タスク | 依存 |
|---|---|---|
| 1 | [管理画面ルートMiddlewareの実装（is_admin判定・404）](01-admin-route-middleware.md) | F-AC-02 Task1 |
| 2 | [管理者ログイン成功後のダッシュボード遷移制御](02-post-login-redirect.md) | 1 |
| 3 | [受入テスト（E2E）](03-acceptance-e2e.md) | 1, 2 |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
