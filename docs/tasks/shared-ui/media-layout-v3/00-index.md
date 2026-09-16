# 写真・動画のモーダルと投稿フォームのサムネイル — タスク分割

> 出典: [media-layout.md](../../../user-stories/shared-ui/media-layout.md)

v1 の `MediaGrid`・`SpotPhotoGalleryScreen` のモーダルを共通部品にし、投稿フォームのサムネイルを追加する。Task 1・2 は独立。

v1 の Epic: #205（v1 の MediaGrid）

| # | タスク | 依存 |
|---|---|---|
| 1 | [写真・動画モーダル（共通部品）](01-media-modal.md) | theme Task 3 |
| 2 | [投稿フォームのサムネイル表示と削除](02-form-thumbnails.md) | theme Task 3 |
| 3 | [受入テスト（E2E）](03-acceptance-e2e.md) | Task 1〜2 すべて |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
