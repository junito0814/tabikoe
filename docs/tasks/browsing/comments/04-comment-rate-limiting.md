# Task 4: コメント投稿レート制限の実装

> 出典: [comments.md](../../../user-stories/browsing/comments.md)
> インデックス: [comments](00-index.md)

## 依存

- [Task 1: コメント投稿 Route Handler（バリデーション・エスケープ処理）](01-comment-create-handler.md)
- F-AC-01 [ログイン試行のレート制限](../../account/signup-login/08-login-rate-limiting.md)（レート制限共通関数の再利用）
- table-catalog [Task1: rate_limits テーブルのスキーマ定義・マイグレーション](../../data-model/table-catalog/01-rate-limits-table.md)

## 実装内容

- F-AC-01・post-creationで実装済みのレート制限共通関数（`rate_limits`テーブル参照・更新）を再利用し、コメント投稿に適用する
- 1ユーザーにつき1分間5件を超えるコメント投稿リクエストを拒否する

## 成果物

- コメント投稿APIへのレート制限組み込み

## テスト要件

### 単体テスト
- 境界値（5件目：許可、6件目：拒否）の挙動を検証する
- 時間枠（1分間）経過後にカウントがリセットされることを検証する

### 結合テスト
- テスト用DBの`rate_limits`テーブルに対して実際にカウントの記録・更新が行われることを確認する

### E2Eテスト
- 同一ユーザーで1分間に6件連続してコメント投稿APIを呼び出し、6件目に429エラーが返ることを確認する

## 関連する受入条件

- 1ユーザーにつき1分間5件を超えるコメント投稿が拒否されること
