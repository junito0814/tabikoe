# Task 1: 写真・動画モーダル（共通部品）

> 出典: [media-layout.md](../../../user-stories/shared-ui/media-layout.md)
> インデックス: [media-layout-v3](00-index.md)

## 依存

- theme Task 3

## 実装内容

- `MediaModal` を作る：起点の写真から開き、左右スワイプ・←→ボタン・矢印キーで前後へ、動画はモーダル内で再生、閉じる。任意で「この投稿を見る」リンクを出せる
- `MediaGrid`（投稿カード・詳細・アルバム）と写真切替（photo-view）から同じ部品を使う

## 成果物

- `src/components/media/MediaModal.tsx`
- `src/components/media/MediaGrid.tsx`（モーダル呼び出し）

## テスト要件

### 単体テスト
- 起点インデックスから開き、前後送りが端で止まること
- キーボードの矢印で前後に送れること

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 3: 受入テスト（E2E）](03-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 写真・動画のタップでモーダルが開き、左右で前後に送れ、動画がモーダル内で再生されること
