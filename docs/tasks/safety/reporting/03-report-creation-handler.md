# Task 3: 通報作成 Route Handler（重複通報防止）

> 出典: [reporting.md](../../../user-stories/safety/reporting.md)
> インデックス: [reporting](00-index.md)

## 依存

- [Task 1: reports テーブルのスキーマ定義・マイグレーション](01-reports-schema-migration.md)

## 実装内容

- `/api/reports`（POST）を実装する。`target_type`・`target_id`・`reason`・`detail`を受け取り、`reports`にINSERTする
- `reason`が`target_type`に対して許容されない組み合わせ（`impersonation`は`user`のみ、`wrong_spot_info`は`spot`のみ）の場合は400エラーを返す
- 一意制約違反（重複通報）はDBエラーを捕捉し、ユーザー向けに「既に通報済みです」等のメッセージを返す409エラーとする
- 通報後、対象コンテンツの表示状態には一切影響を与えない（`status='unconfirmed'`で作成するのみ）

## 成果物

- `app/api/reports/route.ts`

## テスト要件

### 単体テスト
- `reason`と`target_type`の組み合わせバリデーションを検証する（不正な組み合わせで400）
- 自由記述の文字数バリデーション（書記素クラスタ単位で1,000文字超で400）を検証する

### 結合テスト
- テスト用DBで通報が正しく`reports`にINSERTされることを確認する
- 同一ユーザーが同一対象に2回目の通報を行った際、409エラーが返り2件目がINSERTされないことを確認する
- 通報後、対象の投稿・コメント等がAPI応答上も通常どおり取得できる（非表示化されない）ことを確認する

### E2Eテスト
- なし（[Task 5: 受入テスト（E2E）](05-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 同一ユーザーが同一対象に重複して通報できないこと
- 通報後も対象が自動非表示にならず、通常どおり表示され続けること
