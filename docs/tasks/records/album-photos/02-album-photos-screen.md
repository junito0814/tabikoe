# Task 2: アルバム写真一覧画面（SC-21）と SC-09 からの導線

> 出典: [album-photos.md](../../../user-stories/records/album-photos.md)
> インデックス: [album-photos](00-index.md)

## 依存

- [Task 1: アルバム写真一覧取得 Route Handler](01-album-photos-handler.md)
- photo-view [Task 2](../../map-search/photo-view/02-view-toggle-ui.md)（`PhotoGrid`。v3.0 で SC-13 を置き換えた写真切替）
- feedback-0919 [Task 3](../../shared-ui/feedback-0919/03-photo-modal.md)（タップでモーダル＋情報バー、「この投稿を見る →」）

## 実装内容

- `AlbumPhotoGalleryScreen`（SC-21）を `PhotoGrid` の薄いラッパーとして実装する。`PhotoGrid` の `fetchPage` 差し替え口に `GET /api/trips/[id]/photos` を向けた関数を渡す（`PhotoGrid` が `offset` を足す）。見出しは「写真・動画」、戻り先はアルバム名のリンク（`/albums/[id]`）
- ページ `/albums/[id]/photos` を実装する。メンバー以外は404
- アルバム画面（SC-09）のヘッダーに「写真」タグ（SC-04 と同じ見た目）を置き、SC-21 へ遷移する

## 成果物

- `src/components/albums/AlbumPhotoGalleryScreen.tsx`、`app/albums/[id]/photos/page.tsx`
- `AlbumScreen` の「写真」タグ

## テスト要件

### 単体テスト
- アルバムへ戻るリンクが表示され、「もっと見る」で `/api/trips/[id]/photos?offset=` が呼ばれることを検証する
- タップでモーダルが開き、「この投稿を見る →」が元投稿を指すことを検証する（`PhotoGrid` の挙動）
- SC-09 に「写真」タグがあり `/albums/[id]/photos` を指すことを検証する

### 結合テスト
- `PhotoGrid` を使う検索結果の写真切替の既存テストが通ることを確認する

### E2Eテスト
- なし（[Task 3](03-acceptance-e2e.md) でまとめて検証する）

## 関連する受入条件

- アルバム画面の「写真」から一覧表示されること（受入条件45）
- タップでモーダル表示され、「この投稿を見る」で投稿詳細へ遷移できること
