# Task 3: 検索結果のスポット単位化（スポットカード・並び替え）

> 出典: [mentoring-7.md](../../../user-stories/shared-ui/mentoring-7.md)
> インデックス: [mentoring-7](00-index.md)
> 要件: [requirement.md](../../../requirement.md) v3.1 の改訂表

## 依存

- Task 1

## 実装内容

- `GET /api/spots/search`（新設）：`/api/posts/search` と同じ行き先・絞り込み条件で「条件に合う公開投稿があるスポット」を返す。各スポットに 代表写真（最新の投稿の 1 枚目）・★の平均・投稿件数・最新の投稿の感想の冒頭・最新の投稿日時・まだあった・手動登録か・徒歩分（現在地があれば）を付ける。並び替えは 新着順（最新の投稿日時）／評価順（★の平均）／投稿数順。20 件ページング
- `SpotCard` を新設し、`PostSearchScreen` の検索結果（destination が prefecture／nearby のとき）はスポットカードを並べる。スポット別（spot）は従来の投稿カード
- スポットカードのタップで `/spots/[id]`（スポット別）へ。「＋」は SaveButton（追加モードでは直接追加）
- `SortDropdown` の選択肢を文脈で切り替える（検索結果＝新着順／評価順／投稿数順、スポット別＝新着順／評価順／いいね順）

## 成果物

- `src/lib/spots/search-spots.ts`・`src/app/api/spots/search/route.ts`
- `src/components/posts/SpotCard.tsx`
- `src/components/posts/PostSearchScreen.tsx`・`SortDropdown.tsx`・`post-search-query.ts`
- `src/lib/search/load-search-page.ts`

## テスト要件

### 単体テスト
- 同じスポットの投稿が複数あっても 1 件のスポットカードになること
- 並び替え（新着順／評価順／投稿数順）の順序
- 絞り込み条件に合う投稿が無いスポットが除外されること

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 10: 受入テスト（E2E）](10-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 検索結果がスポット単位のカードで、タップするとスポット別の投稿一覧が開くこと（受入条件45）
