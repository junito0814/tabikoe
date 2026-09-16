# Task 1: 取得条件と切替の変更

> 出典: [my-map.md](../../../user-stories/records/my-map.md)
> インデックス: [my-map-v3](00-index.md)

## 依存

- map-display-v3 Task 1
- draft Task 3
- pin-display-rules-v3 Task 1

## 実装内容

- `get-my-map-pins.ts` を、自分の投稿（posted）・保存済み（行きたい＋自分がメンバーのしおり、saved）・下書き（draft、常に）を返すように拡張する。posted が saved より優先
- `MyMapScreen` の切替を 投稿のみ／保存済みのみ／両方 にし、ピン操作の遷移先（posted → 投稿詳細、saved → 投稿一覧、draft → 続きを書く）を設定する

## 成果物

- `src/lib/map/get-my-map-pins.ts`
- `src/components/map/MyMapScreen.tsx`
- `src/components/map/my-map-navigation.ts`

## テスト要件

### 単体テスト
- posted＋saved が posted 1 件になること
- 切替に関わらず draft が含まれること
- 種別ごとの遷移先

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 2: 受入テスト（E2E）](02-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- しおりに入れたスポットが保存済みピンとして表示されること
