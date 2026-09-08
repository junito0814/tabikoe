# F-PO-01 旅行タイトルによる投稿のグルーピング — タスク分割

> 出典: [trip-title.md](../../../user-stories/posts/trip-title.md)

各タスクの詳細・テスト要件は個別ファイルを参照。Task 1〜3（バックエンド）とTask 5（表示範囲制御）は並行着手できる。Task 4はTask 1に依存し、Task 6は全体の結合後に実施する。

本ストーリーは、post-creation Task1で作成される`trips`テーブルに依存する。また本ストーリーの成果物（Task4の入力コンポーネント）は、post-creation Task6でSC-03に統合される。

| # | タスク | 依存 |
|---|---|---|
| 1 | [旅行タイトル オートコンプリート候補取得 Route Handler](01-trip-title-autocomplete-handler.md) | post-creation Task1 |
| 2 | [旅行タイトル作成・紐付けロジック](02-trip-resolution-logic.md) | post-creation Task1 |
| 3 | [旅行タイトル編集（アルバム名変更）Route Handler](03-trip-title-rename-handler.md) | post-creation Task1 |
| 4 | [旅行タイトル入力UI（オートコンプリート付き）](04-trip-title-input-ui.md) | 1 |
| 5 | [表示範囲の制御（マイページ・アルバム画面のみ表示）](05-display-scope-control.md) | post-creation Task1 |
| 6 | [受入テスト（E2E）](06-acceptance-e2e.md) | 1〜5すべて |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
