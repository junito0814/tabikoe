# F-RC-05 「行きたい」保存 — タスク分割

> 出典: [wishlist.md](../../../user-stories/records/wishlist.md)

各タスクの詳細・テスト要件は個別ファイルを参照。Task 1が土台。Task 2・3はTask 1完了後に並行して着手できる。Task 4は全体の結合後に実施する。

`wishlist`テーブルは[table-catalog](../../data-model/table-catalog/00-index.md) Task5で定義済み。

| # | タスク | 依存 |
|---|---|---|
| 1 | [「行きたい」保存・取消 Route Handler](01-wishlist-toggle-handler.md) | table-catalog Task5 |
| 2 | [「行きたい」スポット一覧画面(SC-08)の実装](02-wishlist-list-screen.md) | 1 |
| 3 | [投稿カード一覧・投稿詳細からの保存導線UI](03-wishlist-entry-points-ui.md) | 1 |
| 4 | [受入テスト（E2E）](04-acceptance-e2e.md) | 1〜3すべて |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
