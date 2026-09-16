# Task 4: 位置情報の取得と拒否時の挙動（共通フック）

> 出典: [search-top.md](../../../user-stories/map-search/search-top.md)
> インデックス: [search-top](00-index.md)

## 依存

- なし

## 実装内容

- `useCurrentPosition()`：許可ダイアログ → 成功で座標、拒否・失敗で理由を返す共通フック。タイムアウト 10 秒
- 検索トップの 2 ボタンで使う：「近くのスポットを探す」は拒否時に入力欄へフォーカスして「行き先を入力してください」、「いまいる場所に投稿する」は拒否時に `?lat&lng` 無しで SC-03 を開く（東京駅周辺＋案内）

## 成果物

- `src/lib/geo/use-current-position.ts`
- `src/components/search/SearchTopScreen.tsx`（利用）

## テスト要件

### 単体テスト
- `navigator.geolocation` をモックし、許可／拒否で戻り値が変わること
- 拒否時にそれぞれの挙動になること

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 5: 受入テスト（E2E）](05-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 「近くのスポットを探す」で位置情報を拒否すると、入力欄にフォーカスして案内が表示されること
