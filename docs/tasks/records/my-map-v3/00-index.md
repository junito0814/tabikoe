# F-RC-06 マイマップ（下書き・しおり） — タスク分割

> 出典: [my-map.md](../../../user-stories/records/my-map.md)

v1 の `MyMapScreen`・`get-my-map-pins.ts`・`/api/users/me/map-spots` を土台にする。Task 1 のみ。

v1 の Epic: #174（v1 のマイマップ）

| # | タスク | 依存 |
|---|---|---|
| 1 | [取得条件と切替の変更](01-my-map-kinds.md) | map-display-v3 Task 1、draft Task 3、pin-display-rules-v3 Task 1 |
| 2 | [受入テスト（E2E）](02-acceptance-e2e.md) | Task 1〜1 すべて |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
