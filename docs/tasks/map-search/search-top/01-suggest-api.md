# Task 1: 行き先候補 API（都道府県・駅／市区町村・スポット）

> 出典: [search-top.md](../../../user-stories/map-search/search-top.md)
> インデックス: [search-top](00-index.md)

## 依存

- なし

## 実装内容

- `src/lib/geo/prefectures.ts` に 47 都道府県の固定リスト（名前・読み・中心座標）を置く
- `GET /api/geocode/suggest?q=` を作り、①都道府県の前方一致 ②Google Places Autocomplete（`types: (regions)` と駅、`sessiontoken`、日本に限定。`places.ts` に追加）③`spots` の名前部分一致（投稿数順）を、この順で最大 8 件、種別ラベル付きで返す
- Places の呼び出し回数を抑えるため、q が 2 文字未満では Places を呼ばない

## 成果物

- `src/lib/geo/prefectures.ts`
- `src/app/api/geocode/suggest/route.ts`
- `src/lib/google/places.ts`（autocomplete）

## テスト要件

### 単体テスト
- 「おおさ」で 大阪府（都道府県）が先頭になり、合計が 8 件以下になること
- q が 1 文字では Places が呼ばれないこと（モック）

### 結合テスト
- 実 API で 駅名（例：大阪駅）が駅の種別で返ること

### E2Eテスト
- なし（[Task 5: 受入テスト（E2E）](05-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- ログイン後の着地点が検索トップで、行き先の入力欄・「近くのスポットを探す」・「いまいる場所に投稿する」の 3 つだけが表示されること（受入条件4）
