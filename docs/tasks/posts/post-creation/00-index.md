# F-PO-01 投稿作成 — タスク分割

> 出典: [post-creation.md](../../../user-stories/posts/post-creation.md)

各タスクの詳細・テスト要件は個別ファイルを参照。Task 1が土台（`trips`・`spots`テーブルは[trip-title](../trip-title/00-index.md)・[spot-selection](../spot-selection/00-index.md)のタスクからも参照される）。Task 2〜5はTask 1完了後に並行着手できる。Task 6は本ストーリーおよび関連2ストーリーの成果物を統合した上で実施する。

| # | タスク | 依存 |
|---|---|---|
| 1 | [投稿関連テーブルのスキーマ定義・マイグレーション](01-post-schema-migration.md) | なし |
| 2 | [投稿作成フォームUI（SC-03）基本実装](02-post-form-ui.md) | 1 |
| 3 | [投稿作成 Route Handler（バリデーション・保存）](03-post-creation-handler.md) | 1 |
| 4 | [写真・動画アップロード処理の統合](04-media-upload-integration.md) | 3, F-AC-04 Task3 |
| 5 | [投稿作成レート制限の実装](05-post-creation-rate-limiting.md) | 3, F-AC-01 Task8 |
| 6 | [投稿作成フローの画面統合・受入テスト（E2E）](06-acceptance-e2e.md) | 2, 4, 5, trip-title, spot-selection |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
