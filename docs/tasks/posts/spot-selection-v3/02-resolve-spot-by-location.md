# Task 2: 位置からスポットを解決する API

> 出典: [spot-selection.md](../../../user-stories/posts/spot-selection.md)
> インデックス: [spot-selection-v3](00-index.md)

## 依存

- なし

## 実装内容

- `GET /api/spots/resolve?lat&lng` を作り、半径50m以内の登録済みスポット（Places 由来・手動の双方、`nearby.ts` を流用）があればそれを、無ければ `null` を返す
- フロントは中心変更を 300ms debounce して呼び、結果でスポット名欄を「〈スポット名〉」または「この場所（新しい場所）」に更新する

## 成果物

- `src/app/api/spots/resolve/route.ts`
- `src/lib/spots/resolve-by-location.ts`

## テスト要件

### 単体テスト
- 50m 以内に候補があればそれを、無ければ null を返すこと（距離計算をモック）
- debounce 中の連続呼び出しが 1 回にまとまること

### 結合テスト
- 50m 以内と 60m の 2 スポットで、50m のものだけが返ること

### E2Eテスト
- なし（[Task 5: 受入テスト（E2E）](05-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- SC-03 上部の地図を動かすとピンの指す位置が変わり、半径50m以内に既存スポットがあればそれが自動で選択され、無ければ「この場所（新しい場所）」として投稿時にスポットが新規登録されること（受入条件6）
