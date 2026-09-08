# F-AC-02 セッション管理 — タスク分割

> 出典: [session-management.md](../../../user-stories/account/session-management.md)

各タスクの詳細・テスト要件は個別ファイルを参照。Task 1が土台。Task 2はTask 1に依存し、Task 3・4はTask 2に依存する。Task 5はTask 2・3の統合後に着手し、Task 6は全体の結合後に実施する。

なお本ストーリーは、F-AC-01（サインアップ・ログイン）でログイン時のCookie発行・セッション確立が実装済みであることを前提とする。

| # | タスク | 依存 |
|---|---|---|
| 1 | [セッション検証Middlewareの実装](01-session-verification-middleware.md) | なし |
| 2 | [アクセストークンの自動リフレッシュ処理](02-access-token-auto-refresh.md) | 1 |
| 3 | [リフレッシュトークンの30日失効ルールとログイン誘導](03-refresh-token-expiry-rule.md) | 1, 2 |
| 4 | [Cookieセキュリティ属性の実装・検証](04-cookie-security-attributes.md) | 2 |
| 5 | [フロントエンドの透過的セッション継続UX](05-frontend-seamless-session-ux.md) | 2, 3 |
| 6 | [受入テスト（E2E）](06-acceptance-e2e.md) | 1〜5すべて |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
