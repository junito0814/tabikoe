# Task 1: ログアウト Route Handler（/api/auth/logout）

> 出典: [logout.md](../../../user-stories/account/logout.md)
> インデックス: [logout](00-index.md)

## 依存

- F-AC-02 [セッション検証Middlewareの実装](../session-management/01-session-verification-middleware.md)（ログイン済みであることの検証に利用）
- F-AC-01 [OAuthコールバック Route Handler](../signup-login/04-oauth-callback-handler.md)（Cookie発行の仕組みを前提とする）

## 実装内容

- Supabase Authのサインアウト処理を呼び出し、サーバー側のセッションを無効化する
- アクセストークン・リフレッシュトークンを保持しているCookieを削除する（`Max-Age=0`等）
- 事前条件（ログイン済みであること）はMiddlewareによる検証を前提とする。未ログイン状態での呼び出しは何もせず正常終了とする

## 成果物

- `app/api/auth/logout/route.ts`

## テスト要件

### 単体テスト
- ログアウト処理がSupabaseの`signOut`（モック）を呼び出し、Cookie削除用のレスポンスヘッダーを返すことを検証する
- 未ログイン状態（トークンなし）での呼び出し時に、エラーとせず正常に処理が終了することを検証する

### 結合テスト
- 実際にCookieを保持したリクエストでログアウトAPIを呼び出し、レスポンスのSet-Cookieでトークンが失効することを確認する
- ログアウト後、同じリフレッシュトークンでトークン再発行（リフレッシュ）を試みると失敗することを確認する（Supabase Auth側のセッションが無効化されていることの確認）

### E2Eテスト
- なし（[Task 3: 受入テスト（E2E）](03-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- ログアウト後、アクセストークン・リフレッシュトークンが破棄され未ログイン状態になること
