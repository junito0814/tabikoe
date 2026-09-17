# F-MP-03 ピン操作と地図からの投稿 — タスク分割

> 出典: [pin-interaction.md](../../../user-stories/map-search/pin-interaction.md)

Task 1 が土台。Task 2・3 は独立。

v1 の Epic: #96（v1 のピン操作（タップで一覧））

| # | タスク | 依存 |
|---|---|---|
| 1 | [ピンの吹き出し（一覧・投稿する）](01-pin-callout.md) | map-display-v3 Task 1、post-entry-points Task 1 |
| 2 | [長押しでピンを立てる](02-long-press.md) | map-display-v3 Task 2 |
| 3 | [下書きピンの吹き出し](03-draft-pin-callout.md) | map-display-v3 Task 1、draft Task 3 |
| 4 | [受入テスト（E2E）](04-acceptance-e2e.md) | Task 1〜3 すべて |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
