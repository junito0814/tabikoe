# Task 3: スポット写真一覧（SC-13）への組み込み

> 出典: [media-viewer.md](../../../user-stories/shared-ui/media-viewer.md)
> インデックス: [media-viewer](00-index.md)

## 依存

- [Task 1: MediaViewerModal 共通コンポーネント](01-media-viewer-modal.md)

## 実装内容

- `SpotPhotoGalleryScreen` のサムネイルを投稿詳細へのリンクからボタンに変え、タップで読み込み済みの一覧全体を対象に、その位置から `MediaViewerModal` を開く（←→で他の投稿の写真・動画へも移動できる）
- モーダル内に `link` で「この投稿を見る」（`/posts/[postId]`）を出す。位置を移動すると導線の遷移先も変わる
- spot-photo-gallery [Task 4](../../map-search/spot-photo-gallery/04-post-detail-navigation.md)（タップで投稿詳細へ遷移）はこの導線に置き換える（要件定義書 3.4.5 の v2.10 変更）

## 成果物

- `src/components/media/SpotPhotoGalleryScreen.tsx` の変更

## テスト要件

### 単体テスト
- タップでその位置からモーダルが開き、→で次の投稿の写真へ移動でき、「この投稿を見る」の遷移先が変わることを検証する

### 結合テスト
- 「もっと見る」で追加読み込みした後、追加分にも移動できることを確認する

### E2Eテスト
- なし（[Task 5](05-acceptance-e2e.md) でまとめて検証する）

## 関連する受入条件

- スポット写真一覧のモーダルから元の投稿の詳細へ遷移できること
