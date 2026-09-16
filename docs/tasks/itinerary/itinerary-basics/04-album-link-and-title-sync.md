# Task 4: アルバム画面の「しおりを見る」と旅行タイトル変更の反映

> 出典: [itinerary-basics.md](../../../user-stories/itinerary/itinerary-basics.md)
> インデックス: [itinerary-basics](00-index.md)

## 依存

- Task 1

## 実装内容

- `AlbumScreen` に、同じ旅行にしおりがあり自分がそのメンバーのときだけ「しおりを見る」を出す（`get-album.ts` で判定）
- `PATCH /api/trips/[id]`（タイトル変更）がオーナーのみで、しおり一覧・詳細に即時反映されることを確認する

## 成果物

- `src/components/albums/AlbumScreen.tsx`
- `src/lib/albums/get-album.ts`

## テスト要件

### 単体テスト
- しおりのメンバーでないアルバムメンバーにリンクが出ないこと

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 5: 受入テスト（E2E）](05-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- アルバム画面の「しおりを見る」がしおりのメンバーにだけ表示されること
- 旅行タイトルを変更するとしおりとアルバムの両方に反映されること
