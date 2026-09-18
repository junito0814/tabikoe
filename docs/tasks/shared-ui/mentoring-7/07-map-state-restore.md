# Task 7: 地図の状態の復元

> 出典: [mentoring-7.md](../../../user-stories/shared-ui/mentoring-7.md)
> インデックス: [mentoring-7](00-index.md)
> 要件: [requirement.md](../../../requirement.md) v3.1 の改訂表

## 依存

- Task 6

## 実装内容

- `src/lib/map/map-state.ts`（新設）：地図の中心・ズーム・モード（explore なら徒歩圏も）を sessionStorage に保存・復元する（`list-state.ts` と同じ作り。キーは `/map` のクエリ）
- `MapScreen`：idle のたびに保存し、「戻る」で `/map` に戻ってきたとき（履歴の戻る、または `back` で戻った後にもう一度地図を開いたとき）に復元する。別の入口から新しく開いたとき（`spot`・`itinerary`・`mode=explore` の初回）は復元しない
- 投稿一覧・投稿詳細の左上の戻るが地図へ戻るとき（`?from=map`）は復元を優先する

## 成果物

- `src/lib/map/map-state.ts`
- `src/components/map/MapScreen.tsx`・`NearbyVoices.tsx`
- `src/components/posts/SpotPostListScreen.tsx`・`PostDetailScreen.tsx`（戻るのリンク）

## テスト要件

### 単体テスト
- 保存した状態が同じキーで復元され、別のキーでは復元されないこと
- 徒歩圏の復元

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 10: 受入テスト（E2E）](10-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 地図 → 詳細 → 戻る、で直前の地図の中心・ズームが復元されること（受入条件46）
