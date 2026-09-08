# Task 4: 招待受諾処理（album_membersへの追加）

> 出典: [album-collaboration.md](../../../user-stories/records/album-collaboration.md)
> インデックス: [album-collaboration](00-index.md)

## 依存

- [Task 2: 招待リンク発行 Route Handler](02-invitation-issue-handler.md)
- table-catalog [Task2: album_members テーブルのスキーマ定義・マイグレーション](../../data-model/table-catalog/02-album-members-table.md)

## 実装内容

- `POST /api/invitations/{token}/accept`を実装する
- `token`に対応する`album_invitations`レコードを検索し、`revoked_at`が未設定かつ`expires_at`を過ぎていないことを検証する（いずれかに該当する場合は410 Goneを返す）
- 未ログインの場合はログイン画面へ誘導し、ログイン完了後に本処理へ戻す（3.5.4の未ログイン時誘導パターンに準拠）
- 検証OKの場合、`album_members`に`(trip_id, user_id, role, joined_at)`をINSERTする。招待発行時の`role`をそのまま適用する
- 既に当該旅行のメンバーである場合は重複登録せず、既存のロールを維持する

## 成果物

- `app/api/invitations/[token]/accept/route.ts`（POST）

## テスト要件

### 単体テスト
- 期限切れ・無効化済みトークンでの受諾が拒否されることを検証する
- 既存メンバーが同じ招待を再度開いても重複登録されないことを検証する

### 結合テスト
- テスト用DBで、有効なトークンでログインユーザーが`album_members`に指定ロールで追加されることを確認する
- 未ログイン状態で招待URLを開いた場合、ログイン画面へ誘導され、ログイン完了後に受諾処理が実行されることを確認する

### E2Eテスト
- なし（[Task 8: 受入テスト（E2E）](08-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- リンクを開いたユーザーがログインすると、指定された権限でアルバムのメンバーになれること
- 招待リンクが発行から7日で無効になること
