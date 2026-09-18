# Task 9: しおり一覧の「済」と行きたいの入口、アルバムの名前変更の廃止

> 出典: [mentoring-7.md](../../../user-stories/shared-ui/mentoring-7.md)
> インデックス: [mentoring-7](00-index.md)
> 要件: [requirement.md](../../../requirement.md) v3.1 の改訂表

## 依存

- Task 2

## 実装内容

- `ItineraryListScreen`：期間を過ぎたしおりの `opacity` をやめ、期間の横に「済」の印を付ける。一覧の先頭に「行きたいスポット」への入口（件数つき）を置く（`/wishlist`）
- `AlbumScreen`：「名前を変更」ボタンを削除。しおりがあるアルバムは「しおりを見る」から（名前はしおり詳細のタイトルで変更）、しおりが無いアルバムはタイトルをタップして変更（鉛筆マーク）。「日常」は変更不可（Task 2）
- 期間の表示に年を含める

## 成果物

- `src/components/itineraries/ItineraryListScreen.tsx`
- `src/app/itineraries/page.tsx`（行きたいの件数）
- `src/components/albums/AlbumScreen.tsx`

## テスト要件

### 単体テスト
- 過ぎたしおりに「済」が付き、薄くならないこと
- 先頭の行きたいの入口のリンク先と件数
- アルバム画面に「名前を変更」ボタンが無く、タイトルのタップで変更できること

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 10: 受入テスト（E2E）](10-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- しおり一覧で終わったしおりに「済」が付き薄くならず、先頭に行きたいの入口があること
