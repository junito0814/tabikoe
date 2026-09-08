# Task 3: 招待リンクの手動無効化 Route Handler

> 出典: [album-collaboration.md](../../../user-stories/records/album-collaboration.md)
> インデックス: [album-collaboration](00-index.md)

## 依存

- [Task 1: album_invitations テーブルのスキーマ定義・マイグレーション](01-album-invitations-table-migration.md)

## 実装内容

- `DELETE /api/trips/{id}/invitations/{invitationId}`を実装する
- リクエストしたユーザーが当該旅行のオーナーであることを検証する
- `revoked_at`に現在時刻を設定する（物理削除は行わない）
- 招待受諾処理（Task4）は、`revoked_at`が設定済みのトークンを無効として扱う

## 成果物

- `app/api/trips/[id]/invitations/[invitationId]/route.ts`（DELETE）

## テスト要件

### 単体テスト
- オーナー以外からのリクエストが拒否されることを検証する

### 結合テスト
- テスト用DBでオーナーが招待リンクを無効化し、`revoked_at`が設定されることを確認する
- 無効化後のトークンで招待受諾（Task4）を試み、拒否されることを確認する

### E2Eテスト
- なし（[Task 8: 受入テスト（E2E）](08-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 招待リンクが発行から7日で無効になること。オーナーはいつでも手動で無効化できること
