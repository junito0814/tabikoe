# F-PO-01 位置とスポットの指定（中央固定ピン） — タスク分割

> 出典: [spot-selection.md](../../../user-stories/posts/spot-selection.md)

v1 の `ManualSpotRegistrationModal` の地図部分を切り出して SC-03 の上部にし、`SpotAutocompleteInput`・`/api/spots/search`・`nearby.ts` を流用する。Task 1・2 が土台、Task 3・4 はその後。

v1 の Epic: #144（v1 の候補検索と手動登録モーダル（SC-19））

| # | タスク | 依存 |
|---|---|---|
| 1 | [中央固定ピン地図コンポーネント](01-fixed-pin-map-component.md) | theme Task 2、pin-display-rules-v3 Task 1 |
| 2 | [位置からスポットを解決する API](02-resolve-spot-by-location.md) | なし |
| 3 | [投稿時のスポット確定（新規登録・重複判定・都道府県）](03-spot-finalize-on-publish.md) | Task 2、post-creation-v3 Task 1 |
| 4 | [「変更」からの候補検索と地図連携](04-change-spot-by-name.md) | Task 1、Task 2 |
| 5 | [受入テスト（E2E）](05-acceptance-e2e.md) | Task 1〜4 すべて |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
