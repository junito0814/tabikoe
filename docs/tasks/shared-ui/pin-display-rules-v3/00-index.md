# ピンの表示ルール（8 種別） — タスク分割

> 出典: [pin-display-rules.md](../../../user-stories/shared-ui/pin-display-rules.md)

v1 の `pin-type.ts`・`pin-marker-icon.ts`・`PinIcon` を拡張する。Task 1 → 2 の順。地図側の組み込みは map-display-v3・my-map-v3・itinerary-map-and-post が行う。

v1 の Epic: #215（v1 の通常／行きたい／投稿済み）

| # | タスク | 依存 |
|---|---|---|
| 1 | [ピン種別の拡張とアイコン](01-pin-types-and-icons.md) | theme Task 3 |
| 2 | [凡例コンポーネント](02-map-legend.md) | Task 1 |
| 3 | [受入テスト（E2E）](03-acceptance-e2e.md) | Task 1〜2 すべて |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
