# Task 2: 投稿詳細（SC-05）への組み込み

> 出典: [media-viewer.md](../../../user-stories/shared-ui/media-viewer.md)
> インデックス: [media-viewer](00-index.md)

## 依存

- [Task 1: MediaViewerModal 共通コンポーネント](01-media-viewer-modal.md)

## 実装内容

- `MediaGrid` に `onSelect(index)` を追加し、各枠のタップで位置を通知する。「+N」枠は4点目（index 3）として通知する。`onSelect` が無い場合は従来の挙動（動画のみインライン再生）を残す（開発用プレビューの後方互換）
- `PostMediaGallery`（Client Component）で `MediaGrid` と `MediaViewerModal` をつなぎ、`PostDetailScreen`（Server Component）から `MediaGrid` の代わりに使う
- 4.5.1 のインライン再生は投稿詳細では使わなくなる

## 成果物

- `src/components/media/MediaGrid.tsx` の変更、`src/components/media/PostMediaGallery.tsx`
- `PostDetailScreen` の変更

## テスト要件

### 単体テスト
- `MediaGrid` の各枠タップで正しい index が通知され、「+N」枠で 3 が通知されることを検証する
- `onSelect` 無しでは動画タップがインライン再生のままであることを検証する

### 結合テスト
- 6点以上の投稿で「+N」枠から開き、→で5点目以降に進めることを確認する

### E2Eテスト
- なし（[Task 5](05-acceptance-e2e.md) でまとめて検証する）

## 関連する受入条件

- 投稿詳細で写真・動画をタップするとモーダルで表示されること
