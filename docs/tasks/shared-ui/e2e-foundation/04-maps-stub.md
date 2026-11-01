# Task 4: Google マップのスタブ

> 出典: [e2e-foundation.md](../../../user-stories/shared-ui/e2e-foundation.md)
> インデックス: [e2e-foundation](00-index.md)

## 依存

- Task 1

## 実装内容

**本物を呼ぶと、課金され・結果が毎回変わり・位置情報の許可ダイアログが出る。** 主導線の 4 本すべてが地図を通るので、これを先に入れないと Task 5 が課金される。

外部の Google は **2 つの経路**から呼ばれているので、両方止める。

**(1) ブラウザから呼ぶもの（地図の表示）**

- Playwright の `page.route` で `maps.googleapis.com` への要求を押さえ、**最小限の `google.maps` を定義する JavaScript を返す**
- 用意するのは画面が実際に使っているものだけ（`Map`・`AdvancedMarkerElement`・`LatLng`・`LatLngBounds`・`event`・`importLibrary`）。地図の絵は出さず、**代わりに「地図の代わり」と分かる要素を置く**（テストから位置とピンの数を見られるようにする）
- 位置情報は Playwright の `geolocation` と `permissions` で固定する（東京駅。許可ダイアログを出さない）

**(2) サーバーから呼ぶもの（スポット候補・座標化・経路）**

呼び出しは [`src/lib/google/`](../../../../src/lib/google/) の 4 ファイルに集まっている（`places.ts`・`place-details.ts`・`geocoding.ts`・`routes.ts`）。**ここが 1 か所にまとまっているので、基点だけ差し替えられる。**

- 4 ファイルが読む基点を環境変数（`GOOGLE_API_BASE_URL`、既定は本物）にする
- E2E ではローカルの小さなスタブに向け、**決まった答えを返す**
- **呼ばれた回数を数え、テストから読めるようにする**（「呼んでいないこと」を確かめるため）

**確かめ方。** Playwright 側で `googleapis.com` 宛の要求を**すべて失敗させる**設定を入れ、それでも 4 本が緑になることを見る。通信が残っていればそこで落ちる。

## 成果物

- `e2e/fixtures/maps-stub.ts`（ブラウザ側）
- `e2e/fixtures/google-api-stub.ts`（サーバー側のスタブ）
- `src/lib/google/base-url.ts`（基点。純粋関数）
- `src/lib/google/base-url.test.ts`
- `src/lib/google/places.ts`・`place-details.ts`・`geocoding.ts`・`routes.ts`（基点を読む）

## テスト要件

### 単体テスト

- 基点が未設定なら本物の URL を返し、設定されていればそれを返すこと
- 4 ファイルが基点を通して URL を組み立てていること（直書きが残っていないこと）

### 結合テスト

- スタブに向けたとき、スポット候補・座標化・経路が決まった答えを返すこと

### E2Eテスト

- `googleapis.com` 宛の通信をすべて失敗させた状態で、地図を含む画面が開けること

## 関連する受入条件

- E2E の実行中に Google Maps・Places・Geocoding・Routes への通信が 1 回も出ないこと
