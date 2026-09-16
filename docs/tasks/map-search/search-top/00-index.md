# F-MP-02 検索トップ（ハブ） — タスク分割

> 出典: [search-top.md](../../../user-stories/map-search/search-top.md)

v1 の `/api/geocode`・`PlaceSearchBar` を置き換える。Task 1・4 が土台。Task 2 → 3 の順。

v1 の Epic: #101（v1 の地名検索（地図上部の検索バー））

| # | タスク | 依存 |
|---|---|---|
| 1 | [行き先候補 API（都道府県・駅／市区町村・スポット）](01-suggest-api.md) | なし |
| 2 | [検索トップ画面（SC-00）](02-search-top-screen.md) | Task 1、theme Task 1、menu-bar-v3 Task 1 |
| 3 | [決定時の遷移と座標化](03-submit-and-geocode.md) | Task 2 |
| 4 | [位置情報の取得と拒否時の挙動（共通フック）](04-geolocation-hook.md) | なし |
| 5 | [受入テスト（E2E）](05-acceptance-e2e.md) | Task 1〜4 すべて |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
