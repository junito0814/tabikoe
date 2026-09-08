# Task 6: 受入テスト（E2E）

> 出典: [session-management.md](../../../user-stories/account/session-management.md)
> インデックス: [session-management](00-index.md)

## 依存

- [Task 1: セッション検証Middlewareの実装](01-session-verification-middleware.md)
- [Task 2: アクセストークンの自動リフレッシュ処理](02-access-token-auto-refresh.md)
- [Task 3: リフレッシュトークンの30日失効ルールとログイン誘導](03-refresh-token-expiry-rule.md)
- [Task 4: Cookieセキュリティ属性の実装・検証](04-cookie-security-attributes.md)
- [Task 5: フロントエンドの透過的セッション継続UX](05-frontend-seamless-session-ux.md)

## 実装内容

- Task 1〜5で個別に検証済みの単体・結合テストを前提に、機能横断のE2Eシナリオとして本ストーリーの受入条件をすべて再確認する（回帰確認）

## 成果物

- E2Eテストシナリオ（手動 or 自動、Playwright等）
- 検証結果の記録

## テスト要件

### 単体テスト
- 対象外（本タスクはE2E検証が主目的）

### 結合テスト
- 対象外（Task 1〜5で実施済み）

### E2Eテスト
以下のシナリオを実施する。

1. テスト環境でアクセストークンの有効期限を短縮した状態でログインし、期限切れをまたいで画面操作（投稿一覧の閲覧・遷移など）を継続する
   - エラー表示や強制ログアウトが発生しないこと
2. 最終利用日時を30日超過させたセッション（テスト用にDBを直接操作、またはトークン発行日時を偽装）でログイン必須画面にアクセスする
   - ログイン画面へリダイレクトされ、再ログイン後に元の画面へ復帰すること
3. ログイン中のブラウザで開発者ツールを開き、`document.cookie`を実行する
   - アクセストークン・リフレッシュトークンの値が取得できない（HttpOnlyにより非公開）こと

## 関連する受入条件

- アクセストークンの有効期限切れ時、画面操作を中断せず自動的に再取得されること
- 最終利用から30日経過したセッションでは、再ログインが求められること
- トークンがHttpOnly Cookieで保持され、ブラウザのJavaScriptから参照できないこと
