# F-PO-01 投稿の起点 — タスク分割

> 出典: [post-entry-points.md](../../../user-stories/posts/post-entry-points.md)

SC-03 の初期状態をクエリで受け取り、各画面から配線する。Task 1 が土台、Task 2 は各画面のストーリーと並行して進める。

| # | タスク | 依存 |
|---|---|---|
| 1 | [`/posts/new` のクエリによる初期状態](01-compose-initial-state.md) | post-creation-v3 Task 3、spot-selection-v3 Task 1 |
| 2 | [各入口のリンク配線](02-wire-entry-links.md) | Task 1、search-top Task 2、pin-interaction-v3 Task 1、post-detail-view-v3 Task 1、itinerary-map-and-post Task 2 |
| 3 | [受入テスト（E2E）](03-acceptance-e2e.md) | Task 1〜2 すべて |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
