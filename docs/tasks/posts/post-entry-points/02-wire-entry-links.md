# Task 2: 各入口のリンク配線

> 出典: [post-entry-points.md](../../../user-stories/posts/post-entry-points.md)
> インデックス: [post-entry-points](00-index.md)

## 依存

- Task 1
- search-top Task 2
- pin-interaction-v3 Task 1
- post-detail-view-v3 Task 1
- itinerary-map-and-post Task 2

## 実装内容

- SC-00「いまいる場所に投稿する」、地図の「ここに投稿」・長押し・吹き出し「投稿する」、スポット別一覧・投稿詳細の「自分も投稿する」、しおりの「投稿する」、下書きの「続きを書く」から、Task 1 のクエリで `/posts/new` を開く
- メニューバーに「投稿」が無いことを確認し、v1 の `/posts/new` 直リンク（メニュー）を削除する

## 成果物

- 各画面のリンク（`href` 生成は `src/lib/posts/compose-href.ts` に集約）

## テスト要件

### 単体テスト
- `compose-href` が入口ごとに正しいクエリを組むこと

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 3: 受入テスト（E2E）](03-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 投稿詳細の「自分も投稿する」・既存ピンの「投稿する」でそのスポットが確定した SC-03 が開くこと（受入条件56）
