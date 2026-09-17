# Task 1: 検索 API の行き先対応と付加情報の埋め込み

> 出典: [post-timeline.md](../../../user-stories/map-search/post-timeline.md)
> インデックス: [post-timeline](00-index.md)

## 依存

- table-catalog-v3 Task 4
- spot-selection-v3 Task 3

## 実装内容

- `GET /api/posts/search` を `pref`／`lat&lng`（半径 5km）／`spot` の 3 通りに対応させ、`search-posts.ts` を書き換える。既存の絞り込み（予算・期間・カテゴリ 7・滞在時間・距離）と並び替えは維持する
- 各カード用に `spots.source`（タビコエだけの場所）・`spot_latest_status`（まだあった）・現在地からの直線距離（`lat&lng` が渡されたとき。徒歩分は ÷80 切り上げ）を埋め込む
- `status = 'published'` のみ。20 件ページング

## 成果物

- `src/lib/posts/search-posts.ts`
- `src/app/api/posts/search/route.ts`
- `src/lib/geo/walk-minutes.ts`

## テスト要件

### 単体テスト
- 3 通りの検索条件で正しいクエリが組まれること
- 徒歩分が 80m/分・切り上げで計算されること
- 費用未入力が予算絞り込みで除外されること

### 結合テスト
- 都道府県・周辺 5km・スポット別の 3 通りで期待する投稿が返ること

### E2Eテスト
- なし（[Task 5: 受入テスト（E2E）](05-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 都道府県・駅（周辺 5km）・スポット名の 3 通りの検索で正しい投稿が返ること
- 予算・期間・カテゴリ（7 つ）・滞在時間・距離による絞り込みが動作し、費用未入力の投稿が予算の絞り込みから除外されること（受入条件12）
