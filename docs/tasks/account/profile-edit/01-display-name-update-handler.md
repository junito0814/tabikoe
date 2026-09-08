# Task 1: ユーザー名更新 Route Handler実装

> 出典: [profile-edit.md](../../../user-stories/account/profile-edit.md)
> インデックス: [profile-edit](00-index.md)

## 依存

- F-AC-02 [セッション検証Middlewareの実装](../session-management/01-session-verification-middleware.md)

## 実装内容

- ユーザー名を更新するエンドポイント（例：`PATCH /api/users/me`）を実装する
- 文字数制限（200文字、書記素クラスタ単位でカウント）をサーバー側でバリデーションする
- 認証済みユーザー本人のレコードのみ更新可能とする（Middlewareで検証済みのユーザーIDを用いる）

## 成果物

- `app/api/users/me/route.ts`（PATCH）

## テスト要件

### 単体テスト
- 200文字以内の入力で更新が成功し、201文字の入力では拒否されることを検証する
- 書記素クラスタ単位の文字数カウントロジックについて、絵文字・結合文字が1文字としてカウントされることを検証する
- 未ログイン状態でのリクエストが401等で拒否されることを検証する

### 結合テスト
- テスト用DBに対して実際にUPDATEが実行され、`users.display_name`が更新されることを確認する
- 他ユーザーのレコードを更新しようとした場合に拒否される（RLSまたはアプリ層の認可）ことを確認する

### E2Eテスト
- なし（[Task 6: 受入テスト（E2E）](06-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- ユーザー名を200文字以内で変更できること
