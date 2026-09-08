# Task 1: ブロック／解除 Route Handler

> 出典: [blocking.md](../../../user-stories/safety/blocking.md)
> インデックス: [blocking](00-index.md)

## 依存

- table-catalog [Task5: 対話系テーブルのスキーマ定義・マイグレーション](../../data-model/table-catalog/05-interaction-tables.md)（`blocks`テーブル）

## 実装内容

- `/api/blocks`（POST）でブロックを作成する。`(blocker_id, blocked_id)`の一意制約により、既にブロック済みの相手への重複作成はエラーとする
- `/api/blocks/{blocked_id}`（DELETE）でブロックを解除する
- 自分自身をブロック対象に指定するリクエストは400エラーとする

## 成果物

- `app/api/blocks/route.ts`
- `app/api/blocks/[blocked_id]/route.ts`

## テスト要件

### 単体テスト
- 自分自身へのブロック作成リクエストが400エラーになることを検証する
- 既にブロック済みの相手への重複作成がエラーになることを検証する

### 結合テスト
- テスト用DBでブロックの作成・解除が正しく`blocks`テーブルに反映されることを確認する

### E2Eテスト
- なし（[Task 4: 受入テスト（E2E）](04-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- ユーザーをブロックすると、そのユーザーの投稿・コメント・プロフィール・アルバムが相互に表示されなくなること（作成処理の部分）
- ブロックをいつでも解除できること
