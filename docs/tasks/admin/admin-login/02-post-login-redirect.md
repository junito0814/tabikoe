# Task 2: 管理者ログイン成功後のダッシュボード遷移制御

> 出典: [admin-login.md](../../../user-stories/admin/admin-login.md)
> インデックス: [admin-login](00-index.md)

## 依存

- [Task 1: 管理画面ルートMiddlewareの実装（is_admin判定・404）](01-admin-route-middleware.md)
- signup-login [Task4: OAuthコールバック Route Handler](../../account/signup-login/04-oauth-callback-handler.md)

## 実装内容

- OAuthコールバック処理（既存）が完了した直後に、ログインしたユーザーの`is_admin`を確認する
- `is_admin`がtrueで、かつログイン導線が管理者ログイン画面（SC-15）経由だった場合、通常の「元の遷移先へ戻す」処理（3.5.4）に代えて管理者ダッシュボード（SC-16）へ遷移させる
- 一般ユーザーのログイン導線（SC-01）を経由した場合は、`is_admin`の値にかかわらず既存の遷移ロジック（元の遷移先、またはトップページ）を変更しない

## 成果物

- OAuthコールバック処理からの遷移先分岐ロジック

## テスト要件

### 単体テスト
- 管理者ログイン画面（SC-15）経由かつ`is_admin=true`のケースで、遷移先が管理者ダッシュボードのパスになることを検証する
- 一般ログイン画面（SC-01）経由のケースでは、`is_admin`の値によらず遷移先分岐が発生しないことを検証する

### 結合テスト
- テスト用DBで`is_admin=true`のユーザーが管理者ログイン画面からログインし、実際に管理者ダッシュボードへリダイレクトされることを確認する

### E2Eテスト
- なし（[Task 3: 受入テスト（E2E）](03-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- `is_admin`がtrueのユーザーがログインすると、管理者ダッシュボード（SC-16）に遷移すること
