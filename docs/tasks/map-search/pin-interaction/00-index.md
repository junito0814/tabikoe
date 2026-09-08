# F-MP-03 ピン操作 — タスク分割

> 出典: [pin-interaction.md](../../../user-stories/map-search/pin-interaction.md)

各タスクの詳細・テスト要件は個別ファイルを参照。Task 1が土台。Task 2はTask 1に依存。Task 3はTask 2に依存する（browsing側の対応と合わせて統合）。Task 4は全体の結合後に実施する。

| # | タスク | 依存 |
|---|---|---|
| 1 | [スポット別投稿一覧取得 Route Handler](01-spot-posts-handler.md) | map-display Task1 |
| 2 | [投稿カード一覧画面（SC-04）UI実装](02-post-list-ui.md) | 1 |
| 3 | [投稿詳細画面への遷移統合](03-post-detail-navigation.md) | 2, browsing/post-detail-view |
| 4 | [受入テスト（E2E）](04-acceptance-e2e.md) | 1〜3すべて |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
