# Task 1: 退会実行 Route Handler（ユーザー匿名化・関連データ削除）

> 出典: [account-deletion.md](../../../user-stories/account/account-deletion.md)
> インデックス: [account-deletion](00-index.md)

## 依存

- F-AC-02 [セッション検証Middlewareの実装](../session-management/01-session-verification-middleware.md)
- table-catalog [Task5: 対話系テーブル（comments・likes・wishlist・blocks）のスキーマ定義・マイグレーション](../../data-model/table-catalog/05-interaction-tables.md)

## 実装内容

- 退会エンドポイント（例：`POST /api/users/me/deactivate`）を実装する
- トランザクション内で以下を実行する
  - `users.display_name`を「退会済みユーザー」に、`avatar_url`をデフォルト画像URLに更新する
  - `users.is_deleted`フラグを`true`に設定する（5.3の設計方針に準拠する論理削除）
  - いいね（likes）、「行きたい」保存（wishlist）、ブロック情報（blocks、自分が設定した／された双方）、IdP連携情報を削除する
  - 投稿（posts）・コメント（comments）はレコードを削除せず残す（投稿者表示は`users.display_name`の更新を通じて自動的に匿名化される）
- 認証済みユーザー本人のみ、自分自身を退会させられる
- 退会処理をDB関数（SECURITY DEFINER）として実装する場合は、**`anon`・`authenticated`から実行できないようEXECUTE権限を`service_role`のみに絞る**
  - Supabaseは`public`スキーマの関数をPostgRESTのRPCとして公開し、PostgreSQLは新規関数に既定でPUBLICへEXECUTEを付与する。絞らないと、ブラウザに配布されるpublishable（anon）キーだけで`POST /rest/v1/rpc/<関数名>`に任意のユーザーIDを渡せてしまい、他人のアカウントを匿名化・データ削除できてしまう（「本人のみ」の制限がRoute Handlers側にしか無く迂回される）

## 成果物

- `app/api/users/me/deactivate/route.ts`

## テスト要件

### 単体テスト
- 退会処理関数が、`users`更新および各テーブル（likes/wishlist/blocks/IdP連携）の削除呼び出し（モック）を正しい順序・条件で行うことを検証する
- 未ログイン状態でのリクエストが拒否されることを検証する

### 結合テスト
- テスト用DBに対して実際に退会処理を実行し、`users.display_name`/`avatar_url`/`is_deleted`が更新され、`likes`/`wishlist`/`blocks`/IdP連携情報が削除され、`posts`/`comments`は残存することを確認する
- トランザクションが途中で失敗した場合、全ての変更がロールバックされることを確認する

### E2Eテスト
- なし（[Task 6: 受入テスト（E2E）](06-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 退会後、ユーザー名が「退会済みユーザー」、アイコンがデフォルト画像になること
- 退会後も投稿・コメントは残存し、投稿者表示のみ匿名化されること
- 退会に伴い、いいね・「行きたい」保存・ブロック情報・IdP連携情報が削除されること
