# Task 1: 写真取得 API の検索条件対応

> 出典: [photo-view.md](../../../user-stories/map-search/photo-view.md)
> インデックス: [photo-view](00-index.md)

## 依存

- post-timeline Task 1

## 実装内容

- `GET /api/posts/photos` を作り、`/api/posts/search` と同じ検索・絞り込み・並び替えパラメータを受けて写真・動画を返す（投稿の順→添付順、40 点ページング、公開のみ）。`spot-photos.ts` を汎用化する
- `/spots/[id]/photos` は `/spots/[id]?view=photos` へリダイレクトする

## 成果物

- `src/app/api/posts/photos/route.ts`
- `src/lib/posts/spot-photos.ts` → `search-photos.ts`

## テスト要件

### 単体テスト
- 並び替えが投稿の順序に従い、同じ投稿の写真が添付順で連続すること

### 結合テスト
- 検索条件付きで 40 点ずつ返ること

### E2Eテスト
- なし（[Task 3: 受入テスト（E2E）](03-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 投稿一覧の「写真」切替で、同じ条件の全公開投稿の写真・動画がグリッドで一覧表示され、並び替えが投稿一覧と連動すること（受入条件11）
