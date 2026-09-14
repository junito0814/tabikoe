# Task 2: アルバム写真一覧画面（SC-21）と SC-09 からの導線

> 出典: [album-photos.md](../../../user-stories/records/album-photos.md)
> インデックス: [album-photos](00-index.md)

## 依存

- [Task 1: アルバム写真一覧取得 Route Handler](01-album-photos-handler.md)
- spot-photo-gallery [Task 2](../../map-search/spot-photo-gallery/02-gallery-screen-ui.md)（画面を共通化する）
- media-viewer [Task 3](../../shared-ui/media-viewer/03-gallery-integration.md)（タップでモーダル、「この投稿を見る」）

## 実装内容

- `SpotPhotoGalleryScreen` の本体を `MediaGalleryScreen({ title, backLink, initialPage, fetchPage })` として切り出し、スポット用はその薄いラッパーにする
- `AlbumPhotoGalleryScreen`（SC-21）を `MediaGalleryScreen` のラッパーとして実装する。見出しはアルバム名、戻り先は「アルバムへ戻る」（`/albums/[id]`）、取得元は `GET /api/trips/[id]/photos`
- ページ `/albums/[id]/photos` を実装する。メンバー以外は404
- アルバム画面（SC-09）のヘッダーに「写真」タグ（SC-04 と同じ見た目）を置き、SC-21 へ遷移する

## 成果物

- `src/components/media/MediaGalleryScreen.tsx`（共通化）、`SpotPhotoGalleryScreen` の変更
- `src/components/albums/AlbumPhotoGalleryScreen.tsx`、`app/albums/[id]/photos/page.tsx`
- `AlbumScreen` の「写真」タグ

## テスト要件

### 単体テスト
- アルバム名と「アルバムへ戻る」が表示され、「もっと見る」で `fetchMedia(tripId, offset)` が呼ばれることを検証する
- タップでモーダルが開き、「この投稿を見る」が元投稿を指すことを検証する（共通画面の挙動）
- SC-09 に「写真」タグがあり `/albums/[id]/photos` を指すことを検証する

### 結合テスト
- 共通化後もスポット写真一覧（SC-13）の既存テストが通ることを確認する

### E2Eテスト
- なし（[Task 3](03-acceptance-e2e.md) でまとめて検証する）

## 関連する受入条件

- アルバム画面の「写真」から一覧表示されること（受入条件45）
- タップでモーダル表示され、「この投稿を見る」で投稿詳細へ遷移できること
