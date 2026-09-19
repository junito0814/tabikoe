# Task 5: 投稿カードのコメントプレビュー

> 出典: [feedback-0919.md](../../../user-stories/shared-ui/feedback-0919.md)
> インデックス: [feedback-0919](00-index.md)
> 要件: [requirement.md](../../../requirement.md) v3.2 の改訂表

## 依存

- Task 4（返信を含む件数と最新コメントの取得）

## 実装内容

- `post-cards.ts`：各投稿に `latestComment`（投稿者名・冒頭 1 行。返信を含む最新 1 件。削除済みは除く）と `commentCount`（返信を含む）を埋め込む（PostgREST の埋め込みで 1 件だけ取る）
- `PostCard`：「♥ N 💬 N」の下に、コメントがあるときだけ「〈名前〉 〈冒頭 1 行〉」と「コメント N 件をすべて見る」を出す。どちらを押しても既存のコメント展開（カード直下）が開く。ブロック相手のコメントはプレビューに出さない

## 成果物

- `src/lib/posts/post-cards.ts`
- `src/components/posts/PostCard.tsx`

## テスト要件

### 単体テスト
- コメントがある投稿カードに最新コメントと「コメント N 件をすべて見る」が出て、無い投稿には出ないこと
- 「すべて見る」でコメント欄が展開すること
- 件数に返信が含まれること

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 8: 受入テスト（E2E）](08-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 受入条件78
