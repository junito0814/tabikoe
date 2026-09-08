# F-RC-02 アルバム — タスク分割

> 出典: [album.md](../../../user-stories/records/album.md)

各タスクの詳細・テスト要件は個別ファイルを参照。Task 1が土台。Task 2・3・4はTask 1完了後に並行して着手できる。Task 5は全体の結合後に実施する。

本ストーリーは新規のテーブル定義を追加しない。`trips`・投稿0件時の除外条件は[trip-title](../../posts/trip-title/00-index.md)・[post-delete](../../posts/post-delete/00-index.md)で実装済みのものを再利用する。

| # | タスク | 依存 |
|---|---|---|
| 1 | [アルバム詳細取得 Route Handler（投稿・写真・動画）](01-album-detail-handler.md) | post-creation Task1, post-delete Task2 |
| 2 | [アルバムメンバー一覧の表示](02-album-members-list.md) | table-catalog Task2 |
| 3 | [アルバム名変更（旅行タイトル変更UIの統合）](03-album-title-rename-integration.md) | trip-title Task3, 2 |
| 4 | [アルバム画面UI実装（投稿・写真動画のグリッド表示）](04-album-media-grid-ui.md) | 1, media-layout Task1 |
| 5 | [受入テスト（E2E）](05-acceptance-e2e.md) | 1〜4すべて |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
