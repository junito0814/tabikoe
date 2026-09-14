# Task 4: 投稿カード（SC-04・検索・SC-06・SC-09）への組み込み

> 出典: [media-viewer.md](../../../user-stories/shared-ui/media-viewer.md)
> インデックス: [media-viewer](00-index.md)

## 依存

- [Task 1: MediaViewerModal 共通コンポーネント](01-media-viewer-modal.md)
- browsing/post-detail-view Task1（`GET /api/posts/[id]` が `media` に署名付きURLを返す）

## 実装内容

- `usePostMediaViewer(fetchPostMedia?)` フックを実装する。`openPost(postId)` で `GET /api/posts/[id]` から全メディアを取得し、1点目から `MediaViewerModal` を開く。取得失敗はエラー表示
- `PostCard` に `onOpenMedia` を追加し、渡された場合はサムネイルをリンクの外のボタンにする（リンクの中にボタンを入れ子にしない）。カードの文字部分は従来どおり投稿詳細へのリンク
- 組み込み先: `SpotPostListScreen`（SC-04）、`PostSearchScreen`（検索結果）、`MyPostsList`（SC-06）、`AlbumScreen`（SC-09、代表画像の `MediaGrid` に `onSelect`）
- 「行きたい」一覧（SC-08）はスポットの代表画像で投稿に紐づかないため対象外

## 成果物

- `src/components/media/use-post-media-viewer.tsx`
- `PostCard`・各画面の変更

## テスト要件

### 単体テスト
- サムネイルのタップで投稿IDを渡して全メディアを取得し、1点目からモーダルが開くことを検証する
- 取得失敗時にエラーを表示し、モーダルが開かないことを検証する

### 結合テスト
- 非公開投稿のカード（本人・アルバムメンバーにのみ表示される）からも開けることを確認する（`GET /api/posts/[id]` の閲覧可否判定に従う）

### E2Eテスト
- なし（[Task 5](05-acceptance-e2e.md) でまとめて検証する）

## 関連する受入条件

- 投稿カードのサムネイルをタップするとその投稿の写真・動画がモーダルで表示されること
