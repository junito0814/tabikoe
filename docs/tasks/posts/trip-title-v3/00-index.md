# F-PO-01 旅行タイトル（候補の拡張と仮タイトル） — タスク分割

> 出典: [trip-title.md](../../../user-stories/posts/trip-title.md)

v1 の `resolve-trip.ts`・`TripTitleInput` を拡張する。Task 1・2 は独立。

v1 の Epic: #152（v1 の旅行タイトル）

| # | タスク | 依存 |
|---|---|---|
| 1 | [候補にアルバム・しおりの旅行を含める](01-trip-suggestions.md) | table-catalog-v3 Task 3 |
| 2 | [仮タイトルの自動作成](02-provisional-title.md) | post-creation-v3 Task 1 |
| 3 | [受入テスト（E2E）](03-acceptance-e2e.md) | Task 1〜2 すべて |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
