# F-BG ステータスバッジ — タスク分割

> 出典: [status-badges.md](../../../user-stories/badges/status-badges.md)

各タスクの詳細・テスト要件は個別ファイルを参照。`badges`テーブル（[data-model/table-catalog Task4](../../data-model/table-catalog/04-badges-table.md)）と都道府県判定ロジック（[posts/spot-selection Task6](../../posts/spot-selection/06-prefecture-reverse-geocoding.md)）は既に実装済みのため、本ストーリーはバッジ判定・付与ロジックと画面のみを対象とする。Task 1が土台、Task 2・3は並行着手可能、Task 4・5はTask 1に依存、Task 6は全体の結合後に実施する。

投稿削除時のバッジ非削除保証は、[posts/post-delete Task3](../../posts/post-delete/03-badge-retention-regression-test.md)で既に回帰テスト化されているため、本ストーリーでは扱わない。

| # | タスク | 依存 |
|---|---|---|
| 1 | [バッジ種別・獲得閾値の定義（共通カタログ）](01-badge-catalog-definition.md) | table-catalog Task4 |
| 2 | [投稿数・都道府県バッジの判定ロジック（投稿作成時）](02-post-count-prefecture-badge-evaluation.md) | 1, posts/post-creation Task3, posts/spot-selection Task6 |
| 3 | [いいね数バッジの判定ロジック（いいね受領時）](03-like-count-badge-evaluation.md) | 1 |
| 4 | [ステータスバッジ画面（SC-10）](04-badge-screen-ui.md) | 1 |
| 5 | [バッジ新規獲得時のトースト表示](05-badge-toast-notification.md) | 2, 3 |
| 6 | [受入テスト（E2E）](06-acceptance-e2e.md) | 1〜5すべて |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
