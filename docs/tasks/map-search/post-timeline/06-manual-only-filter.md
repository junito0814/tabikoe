# ~~Task 6: 検索結果に「タビコエだけの場所」の絞り込みを足す~~（2026-10-04 に廃止）

> **2026-10-04 追記**: このタスクで入れた絞り込みは、**入れた翌日に廃止**した（メンタリング 8・ワイヤーフレーム決定事項 70）。
> 「タビコエだけの場所」という考え方そのものを無くしたため。実装を取り消す作業は別タスクで行う。
> 以下は当時の記録として残す。

> 出典: [post-timeline.md](../../../user-stories/map-search/post-timeline.md)
> インデックス: [post-timeline](00-index.md)
> 要件定義書 3.4.2「タビコエだけの場所」、ワイヤーフレーム決定事項 69

## 依存

Task 2（絞り込みシート）、explore-mode Task 4（地図の絞り込み。同じ条件を先に入れてある）

## 背景

2026-10-02 に地図の探すモード（3.4.6）へ「タビコエだけの場所」の絞り込みを入れた。**同じ条件が投稿一覧には無い**（2026-10-03 の相談）。

Google マップに無い場所を探している人のための条件で、**地図でだけ使えるのは不自然**だった。「東京」で検索した結果からも絞れるべき。

## 実装内容

### 6-1. 出す場所

**検索結果（スポットカード）のときだけ。** スポット別の投稿一覧では出さない（そのスポットはもう決まっているので絞る意味が無い）。

| 画面 | 出す |
|---|---|
| 検索結果（都道府県・駅・市区町村 → スポットカード。`SpotSearchScreen`） | **出す** |
| スポット別の投稿一覧（`PostSearchScreen`） | 出さない |
| 地図の探すモード | 既にある（explore-mode Task 4） |

見た目・文言は地図と同じ（チェックボックス 1 行・「**タビコエだけの場所**だけを出す」）。シートは共用の `FilterSheet` なので、**出し分けの引数を 1 つ足すだけ**にする（同じ絵を 2 つ書かない。約束 14）。

### 6-2. 条件を通す道

| 層 | すること |
|---|---|
| URL | `manual=1`（地図と**同じ名前**。地図 → 一覧へ条件を持ち越せる） |
| `PostSearchState` | `manualOnly: boolean` |
| `PostSearchFilters` | 同上 |
| クエリ | `spots.source = manual` で絞る（`baseQuery` は既に `source` を取っている） |
| 絞り込みの数 | `countActiveFilters` に 1 つ数える |

**判定はクエリ側で行う。** 投稿を取ってから捨てると、ページングの件数が合わなくなる。

## 成果物

- `src/lib/posts/search-posts.ts`（`PostSearchFilters`・`parsePostSearchParams`・`applyFilters`）
- `src/components/posts/post-search-query.ts`（状態・URL・数え方）
- `src/components/posts/SpotSearchScreen.tsx`（シートに出し分けを渡す）
- `src/components/posts/FilterSheet.tsx`（出し分けの引数）
- テスト

## テスト要件

### 単体テスト
- `parsePostSearchParams`: `manual=1` を読む。それ以外は条件なし
- `applyFilters`: 入れたとき `spots.source` の条件が付くこと
- URL の書き出し: 入れたときだけ `manual=1` が付くこと
- `countActiveFilters`: 1 つ数えること
- 画面: 検索結果では出て、**スポット別一覧では出ない**こと

### 結合テスト
- なし

### E2Eテスト
- 実機で「東京」と検索し、チェックを入れるとタビコエだけの場所のカードだけになること

## 関連する受入条件

- 3.4.2「タビコエだけの場所」（2026-10-03 追加）
