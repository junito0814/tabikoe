# Task 2: 仮タイトルの自動作成

> 出典: [trip-title.md](../../../user-stories/posts/trip-title.md)
> インデックス: [trip-title-v3](00-index.md)

## 依存

- post-creation-v3 Task 1

## 実装内容

- `resolve-trip.ts` に、タイトルが空のときは「今日の投稿（M/D）」（JST）で解決する分岐を追加する。同名があれば既存の旅行に入る
- マイページ（my-page-v3 Task 2）で仮タイトルを判定できるよう `trips.is_provisional` またはタイトルの規則で判定する関数を用意する

## 成果物

- `src/lib/trips/resolve-trip.ts`
- `src/lib/trips/provisional-title.ts`

## テスト要件

### 単体テスト
- 空タイトルで「今日の投稿（9/16）」が生成され、同日の 2 回目が同じ trip_id を返すこと

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 3: 受入テスト（E2E）](03-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 旅行タイトルを空のまま投稿すると「今日の投稿（M/D）」の旅行が自動で作られ、同日の 2 件目が同じ旅行に入ること
