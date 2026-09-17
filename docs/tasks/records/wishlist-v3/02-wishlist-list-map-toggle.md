# Task 2: SC-08 の一覧／地図切替としおりへ追加

> 出典: [wishlist.md](../../../user-stories/records/wishlist.md)
> インデックス: [wishlist-v3](00-index.md)

## 依存

- Task 1
- map-display-v3 Task 2

## 実装内容

- `WishlistScreen` に一覧／地図の切替を置く。一覧はスポット単位（スポット名・代表写真またはプレースホルダ・都道府県・投稿件数、→ `/spots/[id]`）。地図は `MapScreen` を `?saved=wishlist` で開き、赤ピンだけを出す
- 各行（地図では吹き出し）の「＋」で「しおりと Day を選ぶシート」（`SaveSheet` のしおり部分だけ）を開く。追加しても行きたいから消えない。「解除」で行きたいから外す

## 成果物

- `src/components/wishlist/WishlistScreen.tsx`
- `src/components/save/ItineraryPickerSheet.tsx`
- `src/app/wishlist/page.tsx`

## テスト要件

### 単体テスト
- 切替で URL と表示が変わること
- 「＋」でしおり選択シートが開き、追加後も行が残ること

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 3: 受入テスト（E2E）](03-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- マイページの「行きたい」で一覧／地図を切り替えられ、各スポットの「＋」でしおりと Day を選んで追加でき、追加しても行きたいから消えないこと（受入条件66）
