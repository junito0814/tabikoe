# Task 1: コメント投稿 Route Handler（バリデーション・エスケープ処理）

> 出典: [comments.md](../../../user-stories/browsing/comments.md)
> インデックス: [comments](00-index.md)

## 依存

- table-catalog [Task5: 対話系テーブル（comments・likes・wishlist・blocks）のスキーマ定義・マイグレーション](../../data-model/table-catalog/05-interaction-tables.md)

## 実装内容

- 投稿へのコメント投稿を行うRoute Handlerを実装する（例：`POST /api/posts/{id}/comments`）
- 本文は全角4,000文字までとし、書記素クラスタ単位でカウントする（3.3.1の文字数カウント方針に準拠）
- 保存前にHTMLタグ・スクリプトとして解釈されないようエスケープ処理を行う（7.2準拠）
- 非公開投稿へのコメントは、投稿詳細の閲覧権限（[post-detail-view Task1](../post-detail-view/01-post-detail-handler.md)と同様のアクセス制御）を満たす場合のみ許可する

## 成果物

- `app/api/posts/[id]/comments/route.ts`（POST）
- 入力エスケープ処理の共通関数

## テスト要件

### 単体テスト
- 4,000文字ちょうどのコメントが保存できることを検証する
- 4,001文字（絵文字含む書記素クラスタ単位）のコメントが拒否されることを検証する
- `<script>`タグ等を含む入力が、保存後にスクリプトとして解釈されない形にエスケープされていることを検証する
- 非公開投稿へのアクセス権がないユーザーからのコメント投稿が拒否されることを検証する

### 結合テスト
- テスト用DBで実際に`comments`テーブルへの登録が行われることを確認する

### E2Eテスト
- なし（[Task 7: 受入テスト（E2E）](07-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 投稿にコメントを書き込めること（全角4,000文字まで）
- コメント本文がHTMLタグ・スクリプトとして解釈されず、エスケープされた状態で表示されること
