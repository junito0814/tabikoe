# Task 4: OAuthコールバック Route Handler（/api/auth/callback）

> 出典: [signup-login.md](../../../user-stories/account/signup-login.md)
> インデックス: [signup-login](00-index.md)

## 依存

- [Task 1: Supabase Auth OAuthプロバイダ設定](01-oauth-provider-setup.md)
- [Task 2: users テーブルのスキーマ定義・マイグレーション](02-users-table-migration.md)

## 実装内容

- GoogleからのOAuthコールバックを受け取り、Supabase Auth側でセッションを確立する
- 発行されたアクセストークン・リフレッシュトークンをHttpOnly Cookieに設定する
- 認証失敗時は6.4節のエラーメッセージ（「ログインに失敗しました。時間をおいて再度お試しください」）を表示する

## 成果物

- `app/api/auth/callback/route.ts`

## テスト要件

### 単体テスト
- 正常系：認可コードを受け取り、Supabaseクライアント（モック）がセッション交換に成功した場合、Cookieが正しい属性（HttpOnly, Secure, 適切な有効期限）で設定されることを検証する
- 異常系：Supabaseクライアント（モック）がエラーを返した場合、エラー用の遷移先／レスポンスが返ることを検証する
- 異常系：認可コードが欠落したリクエストに対して、適切な4xxレスポンスを返すことを検証する

### 結合テスト
- テスト用Supabaseプロジェクトに対し、実際のOAuthフローを通して取得した認可コードでコールバックを呼び出し、セッションが確立されることを確認する
- レスポンスのSet-Cookieヘッダーを検査し、トークンがフロントエンドのJavaScriptから読み取れない（HttpOnly）ことを確認する

### E2Eテスト
- 認証プロバイダ側で意図的にログインを拒否／キャンセルした場合、ログイン画面に「ログインに失敗しました。時間をおいて再度お試しください」が表示されることを確認する

## 関連する受入条件

- Googleでサインアップ・ログイン・ログアウトが一連で動作すること
