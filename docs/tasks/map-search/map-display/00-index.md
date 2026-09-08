# F-MP-01 地図表示 — タスク分割

> 出典: [map-display.md](../../../user-stories/map-search/map-display.md)

各タスクの詳細・テスト要件は個別ファイルを参照。Task 1・2が土台（並行着手可）、Task 3はTask 1・2に依存、Task 4・5はTask 3に依存し並行着手できる。Task 6は全体の結合後に実施する。

本ストーリーは、スポットデータ（spot-selection Task1）、ピンの視覚的区別（shared-ui/pin-display-rules Task2）、ログイン必須チェック（session-management Task1）、「行きたい」タブのデータ（records/wishlist）に依存する。

| # | タスク | 依存 |
|---|---|---|
| 1 | [「全体」タブ用ピン取得 Route Handler（/api/spots）](01-spots-fetch-handler.md) | spot-selection Task1 |
| 2 | [「行きたい」タブ用ピン取得ロジック](02-wishlist-tab-integration.md) | records/wishlist |
| 3 | [全体マップ画面（SC-02）UI実装](03-map-screen-ui.md) | 1, 2, session-management Task1 |
| 4 | [ピン種別表示・優先順位ルールの統合](04-pin-type-integration.md) | 3, shared-ui/pin-display-rules Task2 |
| 5 | [地図読み込み障害時のエラー表示統合](05-map-error-handling.md) | 3, shared-ui/error-display Task2 |
| 6 | [受入テスト（E2E）](06-acceptance-e2e.md) | 1〜5すべて |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
