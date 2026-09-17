# Task 1: `/posts/new` のクエリによる初期状態

> 出典: [post-entry-points.md](../../../user-stories/posts/post-entry-points.md)
> インデックス: [post-entry-points](00-index.md)

## 依存

- post-creation-v3 Task 3
- spot-selection-v3 Task 1

## 実装内容

- `/posts/new` が `?lat&lng`（中央固定ピン）、`?spot=<id>`（固定）、`?itinerary=<id>&spot=<id>`（旅行タイトル・訪問日を Day から）、`?draft=<id>` を解釈して `PostComposeScreen` の初期 props を組み立てる（`compose-initial-state.ts` の純粋関数）
- クエリが無い場合は現在地を取得し、拒否時は東京駅周辺＋案内
- 日付の初期値は今日（しおりからは Day の日付、未定・期間未設定なら今日）

## 成果物

- `src/lib/posts/compose-initial-state.ts`
- `src/app/posts/new/page.tsx`

## テスト要件

### 単体テスト
- 7 通りの入口ごとに地図の初期位置・スポット・旅行・日付が表のとおりになること

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 3: 受入テスト（E2E）](03-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 「いまいる場所に投稿する」を押すと、地図画面を挟まず現在地にピンが刺さった SC-03 が開くこと（受入条件49）
