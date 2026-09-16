# F-IT-01 しおりの作成・一覧・削除 — タスク分割

> 出典: [itinerary-basics.md](../../../user-stories/itinerary/itinerary-basics.md)

しおり機能の土台。Task 1 → 2・3 → 4 の順。他の itinerary ストーリーは Task 1・3 に依存する。

| # | タスク | 依存 |
|---|---|---|
| 1 | [しおりの作成・取得・更新・削除 API](01-itinerary-crud-api.md) | table-catalog-v3 Task 2、table-catalog-v3 Task 3 |
| 2 | [しおり一覧画面（SC-22）](02-itinerary-list-screen.md) | Task 1、menu-bar-v3 Task 1、theme Task 3 |
| 3 | [しおり詳細画面の骨格（SC-23）](03-itinerary-detail-shell.md) | Task 1、theme Task 3 |
| 4 | [アルバム画面の「しおりを見る」と旅行タイトル変更の反映](04-album-link-and-title-sync.md) | Task 1 |
| 5 | [受入テスト（E2E）](05-acceptance-e2e.md) | Task 1〜4 すべて |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
