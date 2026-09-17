# Task 1: 着地点の変更と未ログインの SC-00

> 出典: [signup-login.md](../../../user-stories/account/signup-login.md)
> インデックス: [signup-login-v3](00-index.md)

## 依存

- search-top Task 2

## 実装内容

- `post-login-redirect.ts` の既定を `/map` から `/` に変える。`/` はログイン済みなら検索トップ、未ログインならサービス説明一文とログインボタンだけを出す（ログイン済みユーザーの `/map` へのリダイレクトを廃止）
- `proxy.ts` のログイン必須判定から `/` を外し、`/map`・`/search` は必須のままにする

## 成果物

- `src/lib/auth/post-login-redirect.ts`
- `src/app/page.tsx`
- `src/proxy.ts`

## テスト要件

### 単体テスト
- `post-login-redirect` が既定で `/` を返し、`next` があればそれを優先すること

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 2: 受入テスト（E2E）](02-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- ログイン完了後の着地点が検索トップ（SC-00）であること（受入条件4）
