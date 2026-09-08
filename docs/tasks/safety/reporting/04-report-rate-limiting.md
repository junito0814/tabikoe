# Task 4: 通報のレート制限（1日20件）

> 出典: [reporting.md](../../../user-stories/safety/reporting.md)
> インデックス: [reporting](00-index.md)

## 依存

- [Task 3: 通報作成 Route Handler（重複通報防止）](03-report-creation-handler.md)
- table-catalog [Task1: rate_limits テーブルのスキーマ定義・マイグレーション](../../data-model/table-catalog/01-rate-limits-table.md)

## 実装内容

- signup-login [Task8: ログイン試行のレート制限](../../account/signup-login/08-login-rate-limiting.md)と同じ`rate_limits`共通関数を利用し、`/api/reports`（POST）呼び出し前にユーザー単位で直近24時間の通報件数が20件を超えていないか判定する
- 上限超過時は429エラーを返す

## 成果物

- `/api/reports`へのレート制限組み込み

## テスト要件

### 単体テスト
- 境界値（19件目：許可、20件目：許可、21件目：拒否）の挙動を検証する
- 24時間の時間枠経過後にカウントがリセットされることを検証する

### 結合テスト
- テスト用DBの`rate_limits`テーブルに対して、ユーザー単位のカウントが正しく記録・更新されることを確認する

### E2Eテスト
- 同一ユーザーで21件目の通報を試み、429エラーが返ることを確認する

## 関連する受入条件

- 1ユーザーにつき1日20件を超える通報が拒否されること
- レート制限の上限に達した操作が、429エラーとともに拒否されること（8章 受入条件34）
