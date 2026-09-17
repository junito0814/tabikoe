# Task 3: 一覧・吹き出しへの最新報告の埋め込み

> 出典: [spot-status-report.md](../../../user-stories/browsing/spot-status-report.md)
> インデックス: [spot-status-report](00-index.md)

## 依存

- Task 1
- post-timeline Task 1
- map-display-v3 Task 1

## 実装内容

- `search-posts.ts`・`get-map-pins.ts` で `spot_latest_status` ビューを結合し、投稿カード・スポット別見出し・ピンの吹き出しに Task 2 のラベルを出す

## 成果物

- `src/lib/posts/search-posts.ts`
- `src/lib/map/get-map-pins.ts`
- `src/components/posts/PostCard.tsx`

## テスト要件

### 単体テスト
- 報告が無いスポットでラベルが描画されないこと

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 4: 受入テスト（E2E）](04-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 報告が無いスポットには何も表示されないこと
