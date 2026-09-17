# Task 1: 近くの投稿 API

> 出典: [explore-mode.md](../../../user-stories/map-search/explore-mode.md)
> インデックス: [explore-mode](00-index.md)

## 依存

- post-timeline Task 1

## 実装内容

- `GET /api/posts/nearby?lat&lng&radius=`（500／1000／3000、既定 1000）で、半径内の公開投稿を距離が近い順に最大 20 件返す（スポット名・感想冒頭・代表写真・距離・徒歩分・spot_id）。`nearby.ts` の距離計算を流用

## 成果物

- `src/app/api/posts/nearby/route.ts`
- `src/lib/posts/nearby-posts.ts`

## テスト要件

### 単体テスト
- 半径外が除外され、近い順に並ぶこと
- 既定半径が 1000 であること

### 結合テスト
- 実 DB で 20 件上限

### E2Eテスト
- なし（[Task 3: 受入テスト（E2E）](03-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 「近くのスポットを探す」で地図が探すモードで開き、徒歩圏（既定 1km）内の投稿が近い順に下部へ横並びで表示され、徒歩圏の切替が動作すること（受入条件50）
