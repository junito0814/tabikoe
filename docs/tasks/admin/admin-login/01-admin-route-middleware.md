# Task 1: 管理画面ルートMiddlewareの実装（is_admin判定・404）

> 出典: [admin-login.md](../../../user-stories/admin/admin-login.md)
> インデックス: [admin-login](00-index.md)

## 依存

- session-management [Task1: セッション検証Middlewareの実装](../../account/session-management/01-session-verification-middleware.md)

## 実装内容

- `/admin`配下のルートへのリクエストに対し、session-managementのセッション検証Middlewareが解決したユーザー情報の`is_admin`を判定する
- `is_admin`がfalse、または未ログイン（ユーザー情報が解決できない）場合は404を返す（管理画面の存在自体を一般ユーザーに露出させない。リダイレクトやログイン画面誘導は行わない）
- `is_admin`がtrueの場合のみ、後続のRoute Handlers／ページ処理へ通す

## 成果物

- `middleware.ts`（既存のセッション検証Middlewareに`/admin`配下向けの`is_admin`判定を追加）

## テスト要件

### 単体テスト
- `is_admin=true`のユーザーによる`/admin`配下へのリクエストが後続処理に通ることを検証する
- `is_admin=false`のユーザー、および未ログインのリクエストに対し404が返ることを検証する
- `/admin`配下以外のルートには本判定が適用されないことを検証する

### 結合テスト
- テスト用DBで`is_admin=true`／`false`の各ユーザーを用意し、実際に`/admin`配下のURLへリクエストして期待どおりのレスポンス（通過／404）になることを確認する

### E2Eテスト
- なし（[Task 3: 受入テスト（E2E）](03-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- `is_admin`がfalse、または未ログインの状態で`/admin`配下のURLへアクセスすると404が返ること
