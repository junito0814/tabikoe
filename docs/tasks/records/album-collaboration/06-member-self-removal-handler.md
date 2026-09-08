# Task 6: メンバーの自主退出機能

> 出典: [album-collaboration.md](../../../user-stories/records/album-collaboration.md)
> インデックス: [album-collaboration](00-index.md)

## 依存

- table-catalog [Task2: album_members テーブルのスキーマ定義・マイグレーション](../../data-model/table-catalog/02-album-members-table.md)

## 実装内容

- `DELETE /api/trips/{id}/members/me`を実装する
- リクエストしたユーザー自身の`album_members`レコードを削除する
- `role='owner'`のユーザーは本APIでは退出できない（オーナーの離脱は明示的な退出操作を設けず、退会時のオーナー継承ルールのみで扱う。3.6.3準拠）
- 退出しても、それまでの本人の投稿（`posts`）はアルバムに残る（`posts.trip_id`は変更しない）

## 成果物

- `app/api/trips/[id]/members/me/route.ts`（DELETE）

## テスト要件

### 単体テスト
- `role='owner'`のユーザーからの退出リクエストが拒否されることを検証する

### 結合テスト
- テスト用DBで編集者・閲覧者が退出し、`album_members`から削除される一方、当該ユーザーの投稿が`posts`に残存することを確認する

### E2Eテスト
- なし（[Task 8: 受入テスト（E2E）](08-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 編集者・閲覧者が自分の意思でアルバムから退出でき、退出後もそれまでの自分の投稿はアルバムに残ること
