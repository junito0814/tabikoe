# Task 2: 骨組みを先に出す（ストリーミング）

> 出典: [performance.md](../../../user-stories/shared-ui/performance.md)
> インデックス: [performance](00-index.md)

## 依存

- [Task 1: 通信の回数を減らす](01-fewer-round-trips.md)

## 実装内容

1. **`loading.tsx`**: 検索結果／スポット別（`/search`・`/spots/[id]`）、投稿詳細、しおり詳細・一覧、アルバム・一覧、マイページ、通知、行きたい。戻る・見出し・地図の枠・カードの灰色の枠（`src/components/skeleton/Skeletons.tsx`）を即座に出し、ページの HTML が届いた瞬間に置き換わる
2. **検索結果・スポット別一覧の 1 ページ目をストリーミング**: `load-search-page.ts` を `loadSearchShell`（行き先・追加モード・スポットの見出し。速い）と `loadSearchFirstPage`（投稿／スポット／写真の 1 ページ目。遅い）に分ける。page.tsx は骨組みだけ待って HTML を返し始め、1 ページ目の Promise を `StreamingSpotPostListScreen`／`StreamingSpotSearchScreen`（`use(promise)`）に渡す。届くまでは Suspense の fallback（地図の枠＋見出し＋カードの枠）
3. **投稿詳細のコメントをストリーミング**: page.tsx はコメント 1 ページ目を待たず Promise のまま `PostDetailScreen` に渡し、コメント欄だけ Suspense で後から流し込む
4. **失敗時**: 1 ページ目の取得が失敗したら `retryableEmptyFirstPage`（空で `nextOffset: 0`）を渡し、画面側の無限スクロールが取り直す。取り直しも失敗すれば画面側のエラー表示（再試行つき）。コメントは空欄

## 成果物

- `src/components/skeleton/Skeletons.tsx`、各 `loading.tsx`（10 ルート）
- `src/lib/search/load-search-page.ts`（shell／firstPage の分割）、`src/components/posts/StreamingSearchScreens.tsx`
- `src/app/search/page.tsx`・`src/app/spots/[id]/page.tsx`・`src/app/posts/[id]/page.tsx`・`src/components/posts/PostDetailScreen.tsx` の変更

## テスト要件

### 単体テスト
- 骨組みの部品（status「読み込んでいます」、見出し・戻り先の文字）
- ストリーミングの包み: Promise が届くまで骨組み、届いたら本来の画面（スポット別・検索結果）
- 投稿詳細: コメントが Promise なら届くまで骨組み、届いたらコメント欄

### 結合テスト（手動）
- 本番ビルドで HTML の最初の 1 バイトが 0.1 秒以内に届き（TTFB）、1 ページ目が後から流れること

## 関連する受入条件

- performance.md「最初に何か見えるまで」
