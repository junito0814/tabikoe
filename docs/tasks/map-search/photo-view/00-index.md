# F-MP-05 写真の切替 — タスク分割

> 出典: [photo-view.md](../../../user-stories/map-search/photo-view.md)

v1 の `SpotPhotoGalleryScreen`・`spot-photos.ts` を検索条件対応にして SC-04 に組み込む。Task 1 → 2。

v1 の Epic: #109（v1 のスポット写真一覧（SC-13、/spots/[id]/photos））

| # | タスク | 依存 |
|---|---|---|
| 1 | [写真取得 API の検索条件対応](01-photos-api-search-conditions.md) | post-timeline Task 1 |
| 2 | [SC-04 の投稿／写真切替 UI](02-photo-toggle-ui.md) | Task 1、post-timeline Task 2、media-layout-v3 Task 1 |
| 3 | [受入テスト（E2E）](03-acceptance-e2e.md) | Task 1〜2 すべて |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
