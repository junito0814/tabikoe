# Task 5: メンバーの権限変更・削除 Route Handler

> 出典: [album-collaboration.md](../../../user-stories/records/album-collaboration.md)
> インデックス: [album-collaboration](00-index.md)

## 依存

- table-catalog [Task2: album_members テーブルのスキーマ定義・マイグレーション](../../data-model/table-catalog/02-album-members-table.md)

## 実装内容

- `PATCH /api/trips/{id}/members/{userId}`（権限変更）、`DELETE /api/trips/{id}/members/{userId}`（削除）を実装する
- いずれもリクエストしたユーザーが当該旅行のオーナーであることを検証する
- オーナー自身の権限変更・削除は不可とする（オーナー交代は3.6.3のオーナー継承ルール、または[account-deletion](../../account/account-deletion/00-index.md) Task2の対象であり本タスクの範囲外）
- 権限変更・削除いずれも、対象メンバーへの通知は[Task7: 招待・権限変更・削除の通知連携](07-notification-integration.md)で実装する

## 成果物

- `app/api/trips/[id]/members/[userId]/route.ts`（PATCH／DELETE）

## テスト要件

### 単体テスト
- オーナー以外からのリクエストが拒否されることを検証する
- オーナー自身を対象とした変更・削除リクエストが拒否されることを検証する

### 結合テスト
- テスト用DBでオーナーがメンバーの権限を`editor`→`viewer`に変更し、`album_members.role`が更新されることを確認する
- オーナーがメンバーを削除し、`album_members`から当該レコードが削除されることを確認する

### E2Eテスト
- なし（[Task 8: 受入テスト（E2E）](08-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- オーナーがメンバーの権限変更・削除を行えること
