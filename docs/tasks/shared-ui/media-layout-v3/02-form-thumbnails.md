# Task 2: 投稿フォームのサムネイル表示と削除

> 出典: [media-layout.md](../../../user-stories/shared-ui/media-layout.md)
> インデックス: [media-layout-v3](00-index.md)

## 依存

- theme Task 3

## 実装内容

- `PostForm` で選んだ写真・動画をその場に横並びのサムネイルで表示する（動画は ▶ 印）。各サムネイルの × で外せる。末尾に「＋」で追加
- 既存のアップロード処理（`/api/posts/photos`）はそのまま使う

## 成果物

- `src/components/posts/PostForm.tsx`（`MediaThumbnails`）

## テスト要件

### 単体テスト
- 選択した 3 点がサムネイルで並び、× で 1 点外れること
- 動画に ▶ 印が付くこと

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 3: 受入テスト（E2E）](03-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- SC-03 で選んだ写真・動画がその場にサムネイル表示され、× で外せること
