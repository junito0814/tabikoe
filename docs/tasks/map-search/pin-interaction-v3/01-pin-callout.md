# Task 1: ピンの吹き出し（一覧・投稿する）

> 出典: [pin-interaction.md](../../../user-stories/map-search/pin-interaction.md)
> インデックス: [pin-interaction-v3](00-index.md)

## 依存

- map-display-v3 Task 1
- post-entry-points Task 1

## 実装内容

- ピンタップで `PinCallout`（スポット名・星評価・投稿件数・最新の「まだあった」・「一覧」「投稿する」）を出す。「一覧」→ `/spots/[id]`、「投稿する」→ `/posts/new?spot=`
- 右下「ここに投稿」→ `/posts/new?lat&lng`（現在地）

## 成果物

- `src/components/map/PinCallout.tsx`
- `src/components/map/MapScreen.tsx`

## テスト要件

### 単体テスト
- 吹き出しの 2 リンクの遷移先

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 4: 受入テスト（E2E）](04-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- ピンをタップすると吹き出しが出て、「一覧」からスポット別の投稿一覧が表示されること（受入条件10）
