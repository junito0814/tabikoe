# F-VW-03 コメント — タスク分割

> 出典: [comments.md](../../../user-stories/browsing/comments.md)

各タスクの詳細・テスト要件は個別ファイルを参照。Task 1が土台。Task 2・3・4はTask 1完了後に並行して着手できる。Task 5はTask 1に依存し、Task 6はTask 1・3に依存する。Task 7は全体の結合後に実施する。

`comments`テーブルは[table-catalog Task5](../../data-model/table-catalog/05-interaction-tables.md)で定義済みのため、本ストーリーではスキーマ定義は行わない。

| # | タスク | 依存 |
|---|---|---|
| 1 | [コメント投稿 Route Handler（バリデーション・エスケープ処理）](01-comment-create-handler.md) | table-catalog Task5 |
| 2 | [コメント削除 Route Handler（本人のみ）](02-comment-delete-handler.md) | 1 |
| 3 | [コメント一覧取得API（ページング）](03-comment-list-handler.md) | 1 |
| 4 | [コメント投稿レート制限の実装](04-comment-rate-limiting.md) | 1, F-AC-01 Task8 |
| 5 | [コメント通知の送信統合](05-comment-notification-integration.md) | 1, notification-triggers |
| 6 | [コメント欄UI（投稿詳細画面への組み込み）](06-comment-ui.md) | 1, 2, 3 |
| 7 | [受入テスト（E2E）](07-acceptance-e2e.md) | 1〜6すべて |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
