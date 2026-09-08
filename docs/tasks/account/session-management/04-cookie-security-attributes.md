# Task 4: Cookieセキュリティ属性の実装・検証

> 出典: [session-management.md](../../../user-stories/account/session-management.md)
> インデックス: [session-management](00-index.md)

## 依存

- [Task 2: アクセストークンの自動リフレッシュ処理](02-access-token-auto-refresh.md)

## 実装内容

- アクセストークン・リフレッシュトークンを保持するCookieに、HttpOnly・Secure・適切なSameSite属性を付与する
- 初回ログイン時（F-AC-01）だけでなく、Task2の自動リフレッシュ時に再設定されるCookieについても同じ属性が維持されることを保証する
- Cookie発行処理を共通ユーティリティに一本化し、属性の設定漏れを防ぐ

## 成果物

- Cookie設定共通ユーティリティ

## テスト要件

### 単体テスト
- Cookie設定関数が返すSet-Cookie文字列に、HttpOnly・Secure・SameSite属性が含まれることを検証する

### 結合テスト
- 実際のHTTPレスポンスヘッダーを検査し、初回ログイン時・リフレッシュ時いずれのCookieも同一の属性を持つことを確認する

### E2Eテスト
- ブラウザの開発者ツール（またはE2Eテストツールのネットワークインスペクション）で、Cookieが`document.cookie`から参照できない（HttpOnly）ことを確認する

## 関連する受入条件

- トークンがHttpOnly Cookieで保持され、ブラウザのJavaScriptから参照できないこと
