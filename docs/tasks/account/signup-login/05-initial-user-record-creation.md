# Task 5: 初回ログイン時のユーザーレコード作成ロジック

> 出典: [signup-login.md](../../../user-stories/account/signup-login.md)
> インデックス: [signup-login](00-index.md)

## 依存

- [Task 4: OAuthコールバック Route Handler（/api/auth/callback）](04-oauth-callback-handler.md)

## 実装内容

- コールバック処理内で、対応する`public.users`レコードが存在しない場合に新規作成する
- IdPから取得した表示名・アイコン画像を`display_name`・`avatar_url`の初期値として設定する
- `idp_provider`・`idp_subject`・`email`を保存する

## 成果物

- ユーザー作成処理（Route Handlers内の共通関数）

## テスト要件

### 単体テスト
- IdPから返されるペイロード（表示名・アイコンURL・メールアドレス・識別子）を入力として、`users`テーブルへのINSERTパラメータが正しくマッピングされることを検証する
- 表示名・アイコンURLがIdPから返されない場合のフォールバック挙動（デフォルト値の設定など）を検証する

### 結合テスト
- テスト用DBに対して実際にINSERTを実行し、初回ログイン後に`users`テーブルへ1件のレコードが作成され、`display_name`・`avatar_url`がIdPの値と一致することを確認する
- 2回目以降のログインでは新規レコードが作成されず、既存レコードが再利用されることを確認する

### E2Eテスト
- 初回ログイン後にプロフィール画面（SC-07）へ遷移し、ユーザー名・アイコンがIdPの表示名・アイコン画像と一致して表示されることを確認する

## 関連する受入条件

- 初回ログイン時、IdPの表示名・アイコンがユーザー名・アイコンの初期値として設定されること
