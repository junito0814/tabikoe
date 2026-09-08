# Task 5: 投稿作成レート制限の実装

> 出典: [post-creation.md](../../../user-stories/posts/post-creation.md)
> インデックス: [post-creation](00-index.md)

## 依存

- [Task 3: 投稿作成 Route Handler（バリデーション・保存）](03-post-creation-handler.md)
- F-AC-01 [ログイン試行のレート制限](../../account/signup-login/08-login-rate-limiting.md)（レート制限共通関数の再利用）
- table-catalog [Task1: rate_limits テーブルのスキーマ定義・マイグレーション](../../data-model/table-catalog/01-rate-limits-table.md)

## 実装内容

- F-AC-01で実装したレート制限共通関数（`rate_limits`テーブル参照・更新）を再利用し、投稿作成に適用する
- 1ユーザーにつき1時間20件を超える投稿作成リクエストを拒否する

## 成果物

- 投稿作成APIへのレート制限組み込み

## テスト要件

### 単体テスト
- 境界値（20件目：許可、21件目：拒否）の挙動を検証する
- 時間枠（1時間）経過後にカウントがリセットされることを検証する

### 結合テスト
- テスト用DBの`rate_limits`テーブルに対して実際にカウントの記録・更新が行われることを確認する

### E2Eテスト
- 同一ユーザーで21件連続して投稿作成APIを呼び出し、21件目に429エラーが返ることを確認する

## 関連する受入条件

- 1ユーザーにつき1時間20件を超える投稿作成が拒否されること
