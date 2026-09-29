# Task 8: 認証アプリを失ったときの復旧

> 出典: [admin-login.md](../../../user-stories/admin/admin-login.md)
> インデックス: [admin-login](00-index.md)

## 依存

- [Task 5: 管理者の二段階確認画面（SC-32）](05-mfa-screen.md)

## 実装内容

管理者が端末をなくすと、二段階確認を通せず管理画面に入れなくなる。復旧の道を **1 本だけ**用意する。

- **画面には作らない。** 自分の factor を削除する導線を作ると、そこが二段階確認の抜け道になる（アカウントを取られた人がまず factor を消す）。
- 開発者が手元から Supabase の管理 API（service_role）で削除する。`GoTrueAdminMFAApi` の `listFactors` / `deleteFactor` を使う。
- 削除後、その管理者が次に `/admin` を開くと SC-32 の**登録**の状態になり、新しい端末で登録し直せる。

### 成果物にするもの

`scripts/admin-mfa-reset.mjs` を置く。引数はメールアドレス 1 つ。

1. メールアドレスからユーザーを引く
2. `listFactors` で持っている factor を出す（**secret は出さない**）
3. 確認の入力（`yes`）を求めてから `deleteFactor`
4. 消したこと（日時・対象のメールアドレス）を画面に出す

**この操作は画面を通らないので操作の記録（3.10.12）に残らない。** 誰のを・いつ消したかは別に残す運用にする（要件 3.10.1 の運用手順と同じ扱い）。

### 手順書

[docs/deployment.md](../../../deployment.md) に「管理者が認証アプリを失ったとき」の節を足し、上のスクリプトの使い方と、`SUPABASE_SECRET_KEY` を手元に置かずに実行する方法（Vercel の環境変数から一時的に読む／その場で入力する）を書く。

## 成果物

- `scripts/admin-mfa-reset.mjs`
- `docs/deployment.md`（復旧手順の節）
- スクリプトが使う純粋関数のテスト（引数の検証・出力に secret が混ざらないこと）

## テスト要件

### 単体テスト
- 引数が無い・メールアドレスの形でないときに、何もせず終わること
- 出力に secret・`SUPABASE_SECRET_KEY` が含まれないこと（[AGENTS.md](../../../../AGENTS.md) 21）
- 確認の入力が `yes` 以外のときに削除しないこと

### 結合テスト
- 実際のプロジェクトに対しては行わない（本番の factor を消すため）。ローカルの Supabase で、factor を登録 → スクリプトで削除 → SC-32 が登録の状態に戻ることを確認する

### E2Eテスト
- なし（[Task 9](09-acceptance-e2e-mfa.md) でまとめて検証する）

## 関連する受入条件

- 認証アプリを失った管理者を Supabase の管理 API から復旧できること。画面からは自分の factor を削除できないこと
