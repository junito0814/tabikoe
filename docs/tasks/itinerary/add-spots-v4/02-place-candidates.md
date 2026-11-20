# Task 2: 場所の候補を 10 件・住所つき・近い順にする

> 出典: [add-spots.md](../../../user-stories/itinerary/add-spots.md)「名前・住所で探す」
> 要件定義書 3.3.5「名前で選ぶ」（2026-11-07 に変更）・6.2
> インデックス: [add-spots-v4](00-index.md)

## 依存

- Task 1（候補に出してよいかの判断を、作り替えたあとも通す）

## 背景

今の候補（`/api/spots/candidates`）は**全体で 5 件**で、名前しか出ない。登録済みが 5 件あると Google の候補が 1 件も出ず、同じ名前の店を見分けられなかった（要件 3.3.5 の理由）。住所で探す道も無かった。

この候補は**投稿画面（「変更」）としおりのシート（Task 4）の両方**が使う。ここで作り替えておけば、2 つの画面は同じ候補を見る。

## 実装内容

### 2-1. Google から取るものを足す（`src/lib/google/places.ts`）

- `searchPlaces` のフィールドマスクに `places.formattedAddress`・`places.types` を足す。候補の型（`PlaceCandidate`）に `address`・`types` を足す
  - **料金の区分は変わらない見込み**（いま取っている `displayName`・`location` がすでに Text Search の Pro の区分で、`formattedAddress`・`types` も同じ区分）。実装のときに Google の料金表で確かめ、PR に書く
- 近くを先に出すため、`locationBias`（円）を渡せるようにする。**絞り込み（restriction）ではなく偏り（bias）** にする ── 旅行の計画では、遠くの場所も探すため
- 呼ぶのは今までどおり **searchText**（座標まで 1 回で取れる）。autocomplete に替えない（決めてほしいこと 5）
- 住所は**画面に出すためだけ**に使い、保存しない（要件 3.3.5・6.2）

### 2-2. 店か住所かを見分ける（純粋関数）

`classifyPlaceKind(types: string[]): "place" | "address"` を作る。

- `establishment`・`point_of_interest` のどちらかを含む → **店**（`place`）
- 含まず、住所の型（`premise`・`subpremise`・`street_address`・`route`・`sublocality`・`sublocality_level_*`・`geocode` など）を含む → **住所**（`address`）
- どちらでもない（型が空など）→ **店**として扱う（名前が入った状態になり、利用者が直せる。空にして困らせるより害が小さい）

2026-11-14 に確かめた 3 件（`premise`+`street_address`／`sublocality_level_3`+`sublocality`+`political`／`premise`+`street_address`）はすべて住所になる。**店の型は確かめていない**ので、実装の最初に「京都 嵐山 竹林の小径」などで実際の応答を見て、テストの入力に使う（キーを出さない。AGENTS.md 21）。

### 2-3. 候補の並べ方と件数（純粋関数）

`mergePlaceCandidates(stored, google, options)` を作る。要件 3.3.5 の決まりをここに閉じ込める。

1. **タビコエの場所は最大 5 件**（Task 1 の判断を通ったものだけ）
2. **残りを Google の候補で埋め、合わせて最大 10 件**（タビコエが 5 件でも Google は 5 件出る）。Google には `maxResultCount: 10` で頼む
3. **同じ場所は 1 回だけ出す**。Google の候補の Place ID が、タビコエの場所の `place_id` と同じなら Google の側を落とす。~~名前が同じなら落とす~~（今の決まり）は**やめる** ── 同じ名前の別の店（チェーン店）が消えるため（決めてほしいこと 6）
4. **近くを先に出す**。基準の点は、投稿画面では地図の中心、しおりでは「しおりの地域」（Task 4 が渡す）。タビコエの場所は基準の点からの距離で並べ、Google の候補は Google が返した順のまま（bias を掛けてあるので、すでに近い順）
   - 名前で取ってくるとき、`limit(5)` で先に切ると近い場所が漏れる。多めに取り（20 件）、並べてから 5 件に切る
5. 基準の点が無いとき（しおりが空など）は、タビコエの場所を投稿数の多い順にする

> **要決定**（PR の「決めてほしいこと」7）: 「しおりの地域」をどう決めるか、しおりが空のときにどうするか。

### 2-4. 候補に添えるもの

応答の候補に足す。

| 出どころ | 添えるもの（要件 3.3.5） | どこから |
|---|---|---|
| タビコエ | 都道府県・★・投稿数 | `spots.prefecture`、公開の投稿の評価の平均と件数（Task 1 と同じ数え方） |
| Google | 住所・店か住所か（`kind`） | 2-1・2-2 |

- 住所の候補の**表示名**は、Google の `displayName`（`５丁目` のように、それだけでは分からない）ではなく `formattedAddress` を出す（決めてほしいこと 8）。頭の「日本、」と郵便番号は落とす（純粋関数 `formatCandidateAddress`。形は実際の応答で確かめる）

### 2-5. 候補の一覧（`SpotAutocompleteInput`）

- 入力欄の案内を「場所の名前または住所で探す」にする
- 「タビコエの中から」「Google マップから」の見出しは今のまま（`groupBySource`）。タビコエの行に「京都府・★4.4・投稿 12 件」、Google の行に住所を添える
- 見つからないとき：「タビコエにも Google マップにも見つかりませんでした。住所で探すと、その場所に名前を付けて入れられます。」
- Google が使えないとき：タビコエの候補だけを出し「スポット検索が一時的に利用できません」（今の文言のまま）
- 行の右端（Task 4 の Day の札と「＋」）は、差し込み口（`renderTrailing` のような prop）にしておく。投稿画面では何も出さない

## 成果物

- `src/lib/google/places.ts`（フィールドマスク・`locationBias`）
- `src/lib/google/place-kind.ts`（`classifyPlaceKind`・`formatCandidateAddress`）
- `src/lib/spots/merge-place-candidates.ts`（`mergePlaceCandidates`）
- `src/app/api/spots/candidates/route.ts`（`lat`・`lng` を受け取る。応答に `address`・`kind`・`prefecture`・`rating`）
- `src/components/spots/SpotAutocompleteInput.tsx`（添える情報・文言・右端の差し込み口）
- `e2e/fixtures/google-api-stub.mts`（searchText の応答に `formattedAddress`・`types` を足す。店と住所の両方を返せるようにする）

## テスト要件

### 単体テスト
- `classifyPlaceKind`: 2026-11-14 の 3 件が住所になること。店の型（実装の最初に確かめたもの）が店になること。型が空なら店になること
- `mergePlaceCandidates`:
  - タビコエ 7 件・Google 10 件 → タビコエ 5 件＋Google 5 件の 10 件
  - タビコエ 2 件・Google 10 件 → 2 件＋8 件
  - Google の候補とタビコエの場所の Place ID が同じなら、Google の側が消えること。名前が同じだけなら両方残ること
  - タビコエの場所が基準の点から近い順に並ぶこと。基準の点が無ければ投稿数の多い順
- `formatCandidateAddress`: 「日本、」と郵便番号が落ちること
- `SpotAutocompleteInput`: タビコエの行に都道府県・★・投稿数、Google の行に住所が出ること。見つからないとき・Google が使えないときの文言

### 結合テスト
- なし（Places はスタブ。DB の絞り込みは Task 1 の結合テストで見る）

### E2Eテスト
- なし（[Task 6: 受入テスト（E2E）](06-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- しおりの「＋ スポットを追加」でシートが開き、タビコエに無い場所を名前で探して Google の候補から「場所の確認」を経て、選んだ Day に入ること（受入条件 106。候補の部分）
- 住所で探し、名前を付けて追加できること。住所が保存されていないこと（受入条件 108。候補の部分）
