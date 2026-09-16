# F-IT-05 チェック（行った場所） — タスク分割

> 出典: [itinerary-check.md](../../../user-stories/itinerary/itinerary-check.md)

Task 1・2 は独立。Task 3 は Task 1 の後。

| # | タスク | 依存 |
|---|---|---|
| 1 | [チェック API（手動）](01-check-api.md) | itinerary-basics Task 1 |
| 2 | [投稿公開時の自動チェック](02-auto-check-on-publish.md) | itinerary-basics Task 1、post-creation-v3 Task 1、draft Task 3 |
| 3 | [行の表示と地図ピンの連携](03-check-ui-and-map.md) | Task 1、arrival-time Task 3、pin-display-rules-v3 Task 1 |
| 4 | [受入テスト（E2E）](04-acceptance-e2e.md) | Task 1〜3 すべて |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
