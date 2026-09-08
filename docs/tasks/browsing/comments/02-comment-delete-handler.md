# Task 2: コメント削除 Route Handler（本人のみ）

> 出典: [comments.md](../../../user-stories/browsing/comments.md)
> インデックス: [comments](00-index.md)

## 依存

- [Task 1: コメント投稿 Route Handler（バリデーション・エスケープ処理）](01-comment-create-handler.md)

## 実装内容

- コメント削除を行うRoute Handlerを実装する（例：`DELETE /api/comments/{id}`）
- リクエストユーザーがコメント投稿者本人であることを検証し、本人以外からの削除リクエストは拒否する
- 編集用のエンドポイントは設けない（コメントは編集不可のため）

## 成果物

- `app/api/comments/[id]/route.ts`（DELETE）

## テスト要件

### 単体テスト
- コメント投稿者本人からの削除リクエストが成功することを検証する
- 投稿者本人以外（投稿の投稿者やアルバムオーナーを含む）からの削除リクエストが拒否されることを検証する

### 結合テスト
- テスト用DBで実際に`comments`テーブルからレコードが削除されることを確認する

### E2Eテスト
- なし（[Task 7: 受入テスト（E2E）](07-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- コメント投稿者本人のみがコメントを削除できること
- コメントを編集する機能がないこと
