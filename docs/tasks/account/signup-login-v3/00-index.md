# ログイン後の着地点を検索トップに — タスク分割

> 出典: [signup-login.md](../../../user-stories/account/signup-login.md)

v1 の認証フローは変えず、着地点と未ログイン時のトップだけを変える。search-top Task 2 と合わせて実装する。

v1 の Epic: #29（v1 の認証導線）

| # | タスク | 依存 |
|---|---|---|
| 1 | [着地点の変更と未ログインの SC-00](01-post-login-redirect.md) | search-top Task 2 |
| 2 | [受入テスト（E2E）](02-acceptance-e2e.md) | Task 1〜1 すべて |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
