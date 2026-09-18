# Task 4: スポット別一覧・投稿詳細の上 1/3 地図（1：2 のシート）

> 出典: [mentoring-7.md](../../../user-stories/shared-ui/mentoring-7.md)
> インデックス: [mentoring-7](00-index.md)
> 要件: [requirement.md](../../../requirement.md) v3.1 の改訂表

## 依存

- Task 3

## 実装内容

- `StaticSpotMap`（新設）：そのスポットのピン 1 本を置いた操作しない地図（`GoogleMap` を `interactive=false` で使うか、Maps Static API の画像）。タップで `/map?spot=&lat=&lng=&back=` へ
- `SpotPostListScreen` と `PostDetailScreen` を「上 1/3 に StaticSpotMap、下 2/3 にシート（`PostComposeScreen` と同じ引き上げ・引き下げ）」の構成にする。パソコン幅は左 1：右 2
- 「地図で見る」ボタン（スポット別の見出し・投稿詳細・投稿カード）を削除する
- しおり詳細の「地図で見る」は Task 8 で同じ部品を使う

## 成果物

- `src/components/map/StaticSpotMap.tsx`
- `src/components/layout/MapSheetLayout.tsx`（SC-03 のシート挙動を共通化）
- `src/components/posts/SpotPostListScreen.tsx`・`PostDetailScreen.tsx`・`PostCard.tsx`

## テスト要件

### 単体テスト
- 上部の地図のリンク先が `/map?spot=…&back=…` になること
- 「地図で見る」ボタンが描画されないこと

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 10: 受入テスト（E2E）](10-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 投稿詳細の上 1/3 に地図があり、タップすると SC-02 がそのスポット中心で開くこと
