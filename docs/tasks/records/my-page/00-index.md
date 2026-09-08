# F-RC-01 マイページ — タスク分割

> 出典: [my-page.md](../../../user-stories/records/my-page.md)

各タスクの詳細・テスト要件は個別ファイルを参照。Task 1が土台。Task 2・3・4はTask 1完了後に並行して着手できる。Task 5は全体の結合後に実施する。

| # | タスク | 依存 |
|---|---|---|
| 1 | [マイページ画面(SC-06)の基本レイアウト実装](01-my-page-layout.md) | profile-edit Task2 |
| 2 | [投稿数・獲得いいね総数のサマリー集計 Route Handler](02-summary-aggregation-handler.md) | post-creation Task1, table-catalog Task5 |
| 3 | [自分の投稿一覧の取得・旅行単位の絞り込み](03-my-posts-list-handler.md) | post-creation Task1, trip-title Task5 |
| 4 | [遷移メニュー（アルバム／マイマップ／「行きたい」／ステータスバッジ）の導線実装](04-navigation-menu-links.md) | 1 |
| 5 | [受入テスト（E2E）](05-acceptance-e2e.md) | 1〜4すべて |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
