# Task 2: 招待リンク発行 Route Handler

> 出典: [album-collaboration.md](../../../user-stories/records/album-collaboration.md)
> インデックス: [album-collaboration](00-index.md)

## 依存

- [Task 1: album_invitations テーブルのスキーマ定義・マイグレーション](01-album-invitations-table-migration.md)

## 実装内容

- `POST /api/trips/{id}/invitations`を実装する
- リクエストしたユーザーが当該旅行のオーナー（`album_members.role='owner'`）であることを検証する
- 付与する権限（`editor`／`viewer`）をリクエストボディで受け取り、`token`を発行し、`expires_at`を発行時刻の7日後に設定して`album_invitations`にINSERTする
- 発行された`token`を含む招待URL（例：`/invitations/{token}`）を返す

## 成果物

- `app/api/trips/[id]/invitations/route.ts`（POST）

## テスト要件

### 単体テスト
- オーナー以外からのリクエストが拒否されることを検証する
- `expires_at`が発行時刻の7日後として正しく計算されることを検証する

### 結合テスト
- テスト用DBでオーナーが招待リンクを発行し、`album_invitations`にレコードが作成されることを確認する

### E2Eテスト
- なし（[Task 8: 受入テスト（E2E）](08-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- オーナーが招待リンク（付与権限を選択可）を発行できること
