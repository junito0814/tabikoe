# Task 1: `/api/spots` の種別付与（投稿・保存済み・下書き）

> 出典: [map-display.md](../../../user-stories/map-search/map-display.md)
> インデックス: [map-display-v3](00-index.md)

## 依存

- table-catalog-v3 Task 1
- table-catalog-v3 Task 2
- pin-display-rules-v3 Task 1

## 実装内容

- `get-map-pins.ts` を、表示範囲内の ①公開投稿があるスポット ②自分の行きたい＋自分がメンバーのしおりのスポット ③自分の下書き（lat/lng）を 1 回で返すよう拡張し、各ピンに `kind`（post／saved／draft）を付ける（saved が post より優先）
- 最大 100 件。吹き出し用に星平均・件数・最新の「まだあった」を含める

## 成果物

- `src/lib/map/get-map-pins.ts`
- `src/app/api/spots/route.ts`

## テスト要件

### 単体テスト
- saved と post の両方に該当するスポットが saved 1 件になること
- 下書きが本人にだけ含まれること

### 結合テスト
- 範囲内 3 種別のピンが 1 レスポンスで返ること

### E2Eテスト
- なし（[Task 4: 受入テスト（E2E）](04-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 行きたい・しおりの両方に該当するスポットが赤 1 つで表示され、みんなの投稿にも該当する場合は赤が優先されること
