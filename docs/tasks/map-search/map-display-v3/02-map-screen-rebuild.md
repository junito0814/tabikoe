# Task 2: MapScreen の作り替え（タブ・検索バー撤去、凡例、戻る、ここに投稿）

> 出典: [map-display.md](../../../user-stories/map-search/map-display.md)
> インデックス: [map-display-v3](00-index.md)

## 依存

- Task 1
- pin-display-rules-v3 Task 2
- search-top Task 4

## 実装内容

- `MapScreen` からタブ（全体／行きたい）と `PlaceSearchBar` を撤去し、凡例（`MapLegend`）・現在地ボタン・右下「ここに投稿」・左上の戻る（`?spot=` なら「一覧に戻る」、`?itinerary=` なら「しおりに戻る」、それ以外「ホーム」）を置く
- `?spot=<id>` で開いたときはそのスポットを中心にフォーカスピン＋吹き出し
- 「一覧に戻る」は `back` クエリの URL へ戻す（地図位置は保持しない）

## 成果物

- `src/components/map/MapScreen.tsx`
- `src/components/map/PlaceSearchBar.tsx`（削除）
- `src/app/map/page.tsx`

## テスト要件

### 単体テスト
- クエリに応じた戻るボタンの文言と遷移先
- タブが描画されないこと

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 4: 受入テスト（E2E）](04-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 「地図で見る」で地図がそのスポットを中心に開き、「一覧に戻る」で直前の一覧にスクロール位置と絞り込み条件を保ったまま戻ること（受入条件46）
