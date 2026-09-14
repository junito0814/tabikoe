# 写真・動画ビューア（media-viewer） — タスク分割

> 出典: [media-viewer.md](../../../user-stories/shared-ui/media-viewer.md) / 要件定義書 4.5.5（v2.10）

Task 1 が共通コンポーネント。Task 2〜4 は各画面への組み込みで、Task 1 の後に並行して着手できる。Task 5 は全体の結合後に実施する。

| # | タスク | 依存 |
|---|---|---|
| 1 | [MediaViewerModal 共通コンポーネント](01-media-viewer-modal.md) | media-layout Task1（MediaItem 型） |
| 2 | [投稿詳細（SC-05）への組み込み](02-post-detail-integration.md) | 1 |
| 3 | [スポット写真一覧（SC-13）への組み込み](03-gallery-integration.md) | 1 |
| 4 | [投稿カード（SC-04・検索・SC-06・SC-09）への組み込み](04-post-card-integration.md) | 1 |
| 5 | [受入テスト（E2E）](05-acceptance-e2e.md) | 1〜4すべて |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
