# Task 4: 探すモードの絞り込み

> 出典: [explore-mode.md](../../../user-stories/map-search/explore-mode.md)
> インデックス: [explore-mode](00-index.md)
> 要件定義書 3.4.6「絞り込み」、8 章 100

## 依存

Task 1（近くの投稿 API）・Task 2（探すモード UI）

## 背景

探すモードは移動手段で**半径**は変えられるが、**何を探しているか**は指定できない。「いま出先で、ちょうどいい場所を探している人」には足りない（2026-10-02 の相談）。

投稿一覧（3.4.2）には既に絞り込みがあるので、同じものを地図にも置く。

## ここが設計の肝

**ピンとカードの両方に効かせる。** 地図は 2 つの別々の場所からデータを取っている。

| | 取得元 | いまの条件 |
|---|---|---|
| 地図のピン | `getMapPins` ← `/api/map/pins` | 表示範囲だけ |
| 下のカード | `getNearbyPosts` ← `/api/posts/nearby` | 現在地＋移動手段だけ |

**片方だけ直すと食い違って壊れて見える**（地図に出ているピンが、下のカードに無い）。

**ピンの数字も絞り込んだ結果にする。** 「3 件」と出ているのに開いたら 1 件では困るので、**投稿件数・評価の平均・カテゴリ（ピンの色）も、条件に合う投稿だけから計算する**。

`getMapPins` は `spots` から `posts!inner(...)` を埋め込んで取り、**埋め込んだ投稿の配列から集計している**。埋め込み側に条件を足せば、集計は自動的に絞り込み後になる。

## 実装内容

### 4-1. 条件の受け渡し（`src/lib/posts/search-posts.ts` の流用）

絞り込みの判断は**既に輸出されている**ので、書き直さない。

```
export function matchesFilters(...)   1 件が条件に合うかの純粋関数
export function applyFilters<Q>(...)  Supabase のクエリに条件を足す
export function costRangeBounds(...)  予算の下限・上限
export function durationsMatching(...) 滞在時間の束
export interface PostSearchFilters    条件の型
```

**`applyFilters` はそのままは使えない場所がある。** `searchPosts` は `from("posts")` なので条件が `category` のように書けるが、`getMapPins` は `from("spots")` なので `posts.category` と**前置きが要る**。前置きを引数に取る形に広げる（判断の中身は共有する）。

### 4-2. サーバー（`src/lib/map/get-map-pins.ts`・`src/lib/posts/nearby-posts.ts`）

| 関数 | すること |
|---|---|
| `getMapPins` | 埋め込む投稿の列に `cost`・`duration` を足し、埋め込み側に条件を足す。**集計（件数・評価・カテゴリ）は絞り込み後の配列から行う**（いまの実装のままで自動的にそうなる） |
| `getNearbyPosts` | `applyFilters` を通す |

**条件の種類が 2 つある。**

| 条件 | 何に効くか | 判断の仕方 |
|---|---|---|
| カテゴリ・予算・滞在時間 | **投稿** | クエリに足すだけ（`applyFilters`） |
| **「タビコエだけの場所」だけ** | **スポット** | `spots.source = 'manual'` を足すだけ。**集計が要らない**ので最も安い |

**「タビコエだけの場所」はチェックボックスにする**（2026-10-02）。入／切しかなく、**選択肢から 1 つ選ぶものではない**ため。要件 7.7 に合わせて実体のある `input type="checkbox"` を使う（`ConsentCheckbox` と同じ考え方）。`FilterSheet` は選択肢の形（丸いボタン）しか持っていないので、**チェックボックスの行を足す**。
| **評価（平均）** | **スポット（集計後）** | 投稿を絞り込んだあと、**スポットごとに平均を出してから**しきい値で切る |

**評価だけが集計のあとの判断**なので、そこを純粋関数に切り出して単体テストする。

### 4-3. API（`src/app/api/map/pins/route.ts`・`src/app/api/posts/nearby/route.ts`）

絞り込みの条件をクエリから受け取る。**投稿一覧と同じ名前**にする（`parsePostSearchParams` を流用する）。

### 4-4. 画面（`src/components/map/NearbyVoices.tsx`・`MapScreen.tsx`）

```
近くのスポット                    [徒歩 ⌄]   [≡]
```

- **移動手段の横の「移動手段」の文字を外す。** 選択中の手段が見えているので要らない。`<select>` の `aria-label="移動手段"` は残す（読み上げのため）
- その右に**絵だけの絞り込みボタン**。効いているときは色を変え、**効いている条件の数**を付ける
- 押すと `FilterSheet`（投稿一覧と同じ部品）。`hasDistanceCenter={false}` で距離を出さない
- **評価と「タビコエだけの場所」の 2 つは地図だけ**なので、`FilterSheet` に出し分けの引数を足す
- 「タビコエだけの場所」は**チェックボックスの行**として足す（選択肢の形ではない）

### 4-5. 状態の保存（`src/lib/map/map-state.ts`）

絞り込みの条件を URL と地図の状態に保存し、**戻ってきたときに同じ条件で開く**（3.4.3 の復元の一部）。

## 成果物

- `src/lib/posts/search-posts.ts`（`applyFilters` の前置き対応）
- `src/lib/map/explore-filter.ts`（新規。評価の平均の判断。純粋関数）
- `src/lib/map/get-map-pins.ts`・`src/lib/posts/nearby-posts.ts`
- `src/app/api/map/pins/route.ts`・`src/app/api/posts/nearby/route.ts`
- `src/components/map/NearbyVoices.tsx`・`MapScreen.tsx`・`src/components/posts/FilterSheet.tsx`
- `src/lib/map/map-state.ts`
- テスト

## テスト要件

### 単体テスト
- 評価の平均の判断: スポットごとに平均を出してから切ること。1 件だけ ★5 の場所が「★4.5 以上」に残らないこと
- 「タビコエだけの場所」: `source = 'places'`（Google 由来）のスポットが落ちること。**チェックボックスが実体のある `input` であること**（要件 7.7）
- `applyFilters` の前置き: `posts.` を付けたときに同じ条件が組み立てられること
- ピンの集計: **絞り込み後の投稿から**件数・評価・カテゴリが計算されること
- 画面: 絞り込みが効いているときボタンの色と数が変わること。距離が出ないこと
- 状態の保存: 条件が URL と地図の状態に入り、復元されること

### 結合テスト
- なし（サーバーのクエリは単体テストで条件の組み立てを確かめる）

### E2Eテスト
- **実機で確かめる**（要件 8 章 100）。①絞り込むとピンとカードの**両方**が減る ②ピンの件数が絞り込み後の数になる ③投稿一覧へ行って戻ると同じ条件で開く

## 関連する受入条件

- 8 章 100: 探すモードで絞り込みができ、ピンとカードの両方が条件に合うものだけになること。ピンの投稿件数・評価・色も絞り込んだ結果で計算されること。戻ってきたときに同じ条件で開くこと
