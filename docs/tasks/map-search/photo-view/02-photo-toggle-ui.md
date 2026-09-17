# Task 2: SC-04 の投稿／写真切替 UI

> 出典: [photo-view.md](../../../user-stories/map-search/photo-view.md)
> インデックス: [photo-view](00-index.md)

## 依存

- Task 1
- post-timeline Task 2
- media-layout-v3 Task 1

## 実装内容

- `PostSearchScreen`・`SpotPostListScreen` の上部に「投稿／写真」の切替を置き、`?view=photos` でグリッド（`SpotPhotoGalleryScreen` の部品）を出す。並び替えドロップダウンは両方で共通
- 写真のタップで `MediaModal`（「この投稿を見る」付き）

## 成果物

- `src/components/posts/ViewToggle.tsx`
- `src/components/media/PhotoGrid.tsx`（旧 SpotPhotoGalleryScreen）

## テスト要件

### 単体テスト
- 切替で URL が変わり、グリッドが描画されること
- モーダルの「この投稿を見る」リンク

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 3: 受入テスト（E2E）](03-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 検索結果（都道府県・周辺）でもスポット別でも切替が使えること
