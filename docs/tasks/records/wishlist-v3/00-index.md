# F-RC-05 保存先の 2 択と「行きたい」 — タスク分割

> 出典: [wishlist.md](../../../user-stories/records/wishlist.md)

v1 の `WishlistButton`・`/api/wishlist`・`WishlistScreen` を土台にする。Task 1 が土台、Task 2 はその後。

v1 の Epic: #185（v1 の「行きたい」保存）

| # | タスク | 依存 |
|---|---|---|
| 1 | [保存先シート（行きたい＋しおり＋Day）](01-save-sheet.md) | itinerary-basics Task 1、add-spots Task 1、theme Task 3 |
| 2 | [SC-08 の一覧／地図切替としおりへ追加](02-wishlist-list-map-toggle.md) | Task 1、map-display-v3 Task 2 |
| 3 | [受入テスト（E2E）](03-acceptance-e2e.md) | Task 1〜2 すべて |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
