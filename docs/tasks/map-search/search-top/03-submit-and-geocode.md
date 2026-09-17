# Task 3: 決定時の遷移と座標化

> 出典: [search-top.md](../../../user-stories/map-search/search-top.md)
> インデックス: [search-top](00-index.md)

## 依存

- Task 2

## 実装内容

- 候補の種別に応じて `/search?pref=大阪府`、`/search?lat&lng&q=大阪駅`、`/search?spot=<id>` へ遷移する
- 候補に無い文字列で決定したときは `GET /api/geocode?q=` で座標化して周辺検索へ。座標化できなければ入力欄の下に「見つかりませんでした」

## 成果物

- `src/lib/search/build-search-href.ts`
- `src/app/api/geocode/route.ts`（正引きの流用）

## テスト要件

### 単体テスト
- 種別ごとの遷移先 URL が正しいこと
- 座標化失敗時にエラーメッセージが出て遷移しないこと

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 5: 受入テスト（E2E）](05-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 候補に無い文字列を決定すると座標化して周辺検索になり、座標化できなければ「見つかりませんでした」と表示されること
