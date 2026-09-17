# F-MP-01 地図表示（タブ廃止・ピン色・表示情報削減） — タスク分割

> 出典: [map-display.md](../../../user-stories/map-search/map-display.md)

v1 の `GoogleMap`・`MapScreen`・`get-map-pins.ts`・`/api/spots` を土台にする。Task 1 が土台、Task 2 → 3。

v1 の Epic: #89（v1 の地図表示（タブ・検索バー））

| # | タスク | 依存 |
|---|---|---|
| 1 | [`/api/spots` の種別付与（投稿・保存済み・下書き）](01-pins-api-kinds.md) | table-catalog-v3 Task 1、table-catalog-v3 Task 2、pin-display-rules-v3 Task 1 |
| 2 | [MapScreen の作り替え（タブ・検索バー撤去、凡例、戻る、ここに投稿）](02-map-screen-rebuild.md) | Task 1、pin-display-rules-v3 Task 2、search-top Task 4 |
| 3 | [表示情報削減スタイルの適用と検証](03-map-style-application.md) | theme Task 2 |
| 4 | [受入テスト（E2E）](04-acceptance-e2e.md) | Task 1〜3 すべて |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
