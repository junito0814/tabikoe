# Task 3: バッジ保持ロジックの回帰テスト

> 出典: [post-delete.md](../../../user-stories/posts/post-delete.md)
> インデックス: [post-delete](00-index.md)

## 依存

- [Task 1: 投稿削除 Route Handler（カスケード削除）](01-post-delete-handler.md)
- table-catalog [Task4: badges テーブルのスキーマ定義・マイグレーション](../../data-model/table-catalog/04-badges-table.md)
- badges/status-badges [Task2: 投稿数・都道府県バッジの判定ロジック（投稿作成時）](../../badges/status-badges/02-post-count-prefecture-badge-evaluation.md)

## 実装内容

- 獲得済みバッジは`badges`テーブルで別管理されており、投稿削除処理（Task1）が`badges`テーブルに一切書き込まないことを実装として確認・担保する
- バッジ判定ロジック自体は[badges/status-badges](../../badges/status-badges/00-index.md)ストーリーで実装される。本タスクはそのロジックに変更を加えるものではなく、「削除処理が`badges`へ影響しないことを保証する回帰テストの追加」のみを対象とする

## 成果物

- 投稿削除時のバッジ非変更を保証する回帰テスト

## テスト要件

### 単体テスト
- 投稿削除処理関数の呼び出しをトレースし、`badges`テーブルへの書き込み・削除操作が一切発生しないことを検証する

### 結合テスト
- テスト用DBで、投稿数バッジ（例：10件）を獲得済みのユーザーが投稿を削除して投稿数が条件を下回った後も、`badges`テーブルの該当レコードが残存することを確認する
- いいね数バッジについても同様に、投稿削除に伴いいいね数が条件を下回っても`badges`が残存することを確認する

### E2Eテスト
- なし（[Task 5: 受入テスト（E2E）](05-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 投稿削除により投稿数・いいね数が獲得条件を下回っても、獲得済みバッジは失われないこと
