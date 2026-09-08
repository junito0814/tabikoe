# F-VW-02 いいね — タスク分割

> 出典: [likes.md](../../../user-stories/browsing/likes.md)

各タスクの詳細・テスト要件は個別ファイルを参照。Task 1が土台。Task 2・3はTask 1完了後に並行して着手できる。Task 4は全体の結合後に実施する。

`likes`テーブルは[table-catalog Task5](../../data-model/table-catalog/05-interaction-tables.md)で定義済みのため、本ストーリーではスキーマ定義は行わない。

| # | タスク | 依存 |
|---|---|---|
| 1 | [いいね付与・取り消し Route Handler](01-like-toggle-handler.md) | table-catalog Task5 |
| 2 | [いいね通知の送信統合](02-like-notification-integration.md) | 1, notification-triggers |
| 3 | [いいねボタンUI（投稿カード・投稿詳細）](03-like-button-ui.md) | 1 |
| 4 | [受入テスト（E2E）](04-acceptance-e2e.md) | 1〜3すべて |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
