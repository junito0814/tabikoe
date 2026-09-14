# F-RC-02 アルバム写真一覧（album-photos） — タスク分割

> 出典: [album-photos.md](../../../user-stories/records/album-photos.md) / 要件定義書 3.6.2（v2.11）

Task 1 が土台。Task 2 は Task 1 の後。Task 3 は全体の結合後に実施する。新規のテーブル定義は追加しない。

| # | タスク | 依存 |
|---|---|---|
| 1 | [アルバム写真一覧取得 Route Handler](01-album-photos-handler.md) | spot-photo-gallery Task1（`mergeSpotMedia`）、album-collaboration Task2（`getAlbumRole`） |
| 2 | [アルバム写真一覧画面（SC-21）と SC-09 からの導線](02-album-photos-screen.md) | 1, spot-photo-gallery Task2（画面の共通化）, media-viewer Task3 |
| 3 | [受入テスト（E2E）](03-acceptance-e2e.md) | 1〜2 |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
