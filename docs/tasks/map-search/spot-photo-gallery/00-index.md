# F-MP-05 スポット写真一覧 — タスク分割

> 出典: [spot-photo-gallery.md](../../../user-stories/map-search/photo-view.md)

各タスクの詳細・テスト要件は個別ファイルを参照。Task 1が土台。Task 2はTask 1に依存し、shared-ui/media-layoutの動画サムネイル表示を再利用する。Task 3はTask 2に、Task 4はTask 2に依存し並行着手できる。Task 5は全体の結合後に実施する。

| # | タスク | 依存 |
|---|---|---|
| 1 | [スポット写真一覧取得 Route Handler](01-spot-photos-handler.md) | pin-interaction Task1 |
| 2 | [スポット写真一覧画面（SC-13）UI実装](02-gallery-screen-ui.md) | 1, shared-ui/media-layout |
| 3 | [投稿一覧画面（SC-04）からの「写真」タグ導線実装](03-photo-tag-entry-point.md) | 2 |
| 4 | [タップ時の元投稿詳細への遷移統合](04-post-detail-navigation.md) | 2, browsing/post-detail-view |
| 5 | [受入テスト（E2E）](05-acceptance-e2e.md) | 1〜4すべて |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
