# F-MP-02 地名検索 — タスク分割

> 出典: [place-search.md](../../../user-stories/map-search/place-search.md)

各タスクの詳細・テスト要件は個別ファイルを参照。Task 1が土台。Task 2はTask 1およびmap-display Task3に依存する。Task 3は全体の結合後に実施する。

| # | タスク | 依存 |
|---|---|---|
| 1 | [地名検索 Route Handler（/api/geocode）](01-geocode-handler.md) | なし |
| 2 | [検索バーUI・地図移動ロジックの実装](02-search-bar-ui.md) | 1, map-display Task3 |
| 3 | [受入テスト（E2E）](03-acceptance-e2e.md) | 1, 2 |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
