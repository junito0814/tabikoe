# F-PO-01 スポット指定（検索・手動登録） — タスク分割

> 出典: [spot-selection.md](../../../user-stories/posts/spot-selection.md)

各タスクの詳細・テスト要件は個別ファイルを参照。Task 1（近傍検索基盤）が土台。Task 2はTask 1と独立して着手できる。Task 3はTask 2に、Task 4はTask 3に、Task 5はTask 1に、Task 6はTask 5に依存する。Task 7は全体の結合後に実施する。

本ストーリーは、post-creation Task1で作成される`spots`テーブルに依存する。また本ストーリーの成果物（Task3・4の入力コンポーネント）は、post-creation Task6でSC-03に統合される。

| # | タスク | 依存 |
|---|---|---|
| 1 | [spots テーブルの近傍検索インデックス整備](01-spots-geo-search-index.md) | post-creation Task1 |
| 2 | [スポット候補検索 Route Handler](02-spot-search-handler.md) | post-creation Task1 |
| 3 | [スポット名オートコンプリートUI](03-spot-autocomplete-ui.md) | 2 |
| 4 | [スポット手動登録画面（SC-19）UI実装](04-manual-spot-registration-ui.md) | 3 |
| 5 | [スポット手動登録 Route Handler（重複防止ロジック含む）](05-manual-spot-registration-handler.md) | 1 |
| 6 | [逆ジオコーディングによる都道府県判定の統合](06-prefecture-reverse-geocoding.md) | 5 |
| 7 | [受入テスト（E2E）](07-acceptance-e2e.md) | 2〜6すべて |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
