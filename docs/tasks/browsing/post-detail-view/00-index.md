# F-VW-01 投稿詳細閲覧 — タスク分割

> 出典: [post-detail-view.md](../../../user-stories/browsing/post-detail-view.md)

各タスクの詳細・テスト要件は個別ファイルを参照。Task 1が土台。Task 2・3はTask 1完了後に並行して着手できる。Task 4は全体の結合後に実施する。

本ストーリーは、post-creation（投稿作成）で定義済みのスキーマを前提とする。コメント欄・「行きたい」ボタンの機能自体は、それぞれ[comments](../comments/00-index.md)・records（`records`カテゴリ、別途作成）のタスクに委ね、本ストーリーでは画面への組み込み（導線設置）のみを扱う。

| # | タスク | 依存 |
|---|---|---|
| 1 | [投稿詳細取得・非公開アクセス制御 Route Handler（GET /api/posts/{id}）](01-post-detail-handler.md) | post-creation Task1 |
| 2 | [投稿詳細画面UI（SC-05）実装](02-post-detail-ui.md) | 1 |
| 3 | [未ログイン時のログイン誘導・遷移復帰処理](03-login-redirect-return-flow.md) | session-management Task1 |
| 4 | [受入テスト（E2E）](04-acceptance-e2e.md) | 1〜3すべて |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
