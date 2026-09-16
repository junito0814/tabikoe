# Task 3: スクロール位置・条件の保持と「一覧に戻る」

> 出典: [post-timeline.md](../../../user-stories/map-search/post-timeline.md)
> インデックス: [post-timeline](00-index.md)

## 依存

- Task 2

## 実装内容

- 検索条件・絞り込み・並び替えを URL クエリに持ち、スクロール位置と読み込み済みページ数を `sessionStorage`（キー＝URL）に保存する
- 地図の「一覧に戻る」（`/map?...&back=<encoded search url>`）で戻ったとき、同じ位置・条件で復元する
- 左上の戻るは検索トップへ

## 成果物

- `src/lib/search/list-state.ts`
- `src/components/posts/PostSearchScreen.tsx`（復元）

## テスト要件

### 単体テスト
- 保存した状態が URL キーで復元されること

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 5: 受入テスト（E2E）](05-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 「一覧に戻る」で戻ったときにスクロール位置と絞り込み条件が保たれること（受入条件46）
