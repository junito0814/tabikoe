# F-IT-06 しおりの地図表示と投稿 — タスク分割

> 出典: [itinerary-map-and-post.md](../../../user-stories/itinerary/itinerary-map-and-post.md)

Task 1・2 は独立。

| # | タスク | 依存 |
|---|---|---|
| 1 | [しおり表示の地図（番号ピン・Day タブ・すべて）](01-itinerary-map-view.md) | itinerary-basics Task 1、map-display-v3 Task 2、pin-display-rules-v3 Task 1 |
| 2 | [「投稿一覧」「投稿する」「投稿済み」の導線](02-spot-row-links.md) | arrival-time Task 3、post-entry-points Task 1 |
| 3 | [受入テスト（E2E）](03-acceptance-e2e.md) | Task 1〜2 すべて |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
