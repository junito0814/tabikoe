# F-PO-03 投稿削除 — タスク分割

> 出典: [post-delete.md](../../../user-stories/posts/post-delete.md)

各タスクの詳細・テスト要件は個別ファイルを参照。Task 1が土台。Task 2・3・4はTask 1完了後に並行して着手できる。Task 5は全体の結合後に実施する。

| # | タスク | 依存 |
|---|---|---|
| 1 | [投稿削除 Route Handler（カスケード削除）](01-post-delete-handler.md) | post-creation Task1 |
| 2 | [アルバム一覧表示のゼロ件時非表示ロジック](02-empty-album-hiding.md) | 1 |
| 3 | [バッジ保持ロジックの回帰テスト](03-badge-retention-regression-test.md) | 1 |
| 4 | [投稿削除UI（確認ダイアログ含む）](04-post-delete-ui.md) | 1 |
| 5 | [受入テスト（E2E）](05-acceptance-e2e.md) | 1〜4すべて |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
