# F-MP-06 探すモード（近くの声） — タスク分割

> 出典: [explore-mode.md](../../../user-stories/map-search/explore-mode.md)

Task 1 → 2。

| # | タスク | 依存 |
|---|---|---|
| 1 | [近くの投稿 API](01-nearby-posts-api.md) | post-timeline Task 1 |
| 2 | [探すモード UI](02-explore-ui.md) | Task 1、map-display-v3 Task 2、search-top Task 4 |
| 3 | [受入テスト（E2E）](03-acceptance-e2e.md) | Task 1〜2 すべて |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
