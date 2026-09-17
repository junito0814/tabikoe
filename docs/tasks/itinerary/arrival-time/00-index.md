# F-IT-03 到着予定時刻と並び順・メモ — タスク分割

> 出典: [arrival-time.md](../../../user-stories/itinerary/arrival-time.md)

Task 1 が土台。Task 2・3 は Task 1 の後。

| # | タスク | 依存 |
|---|---|---|
| 1 | [スポット更新 API と並び順ロジック](01-spot-update-api-and-ordering.md) | itinerary-basics Task 1 |
| 2 | [10 分刻みの時刻ピッカー部品](02-time-picker.md) | theme Task 3 |
| 3 | [スポット行の UI（時刻・メモ・並び替え・削除）](03-spot-row-ui.md) | Task 1、Task 2、itinerary-basics Task 3 |
| 4 | [受入テスト（E2E）](04-acceptance-e2e.md) | Task 1〜3 すべて |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
