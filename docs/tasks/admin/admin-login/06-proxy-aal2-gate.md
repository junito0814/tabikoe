# Task 6: 関所で `/admin`・`/api/admin` に `aal2` と 60 分を必須にする

> 出典: [admin-login.md](../../../user-stories/admin/admin-login.md)
> インデックス: [admin-login](00-index.md)

## 依存

- [Task 4: 二段階確認の判定を純粋関数に切り出す](04-mfa-decision-rules.md)
- [Task 5: 管理者の二段階確認画面（SC-32）](05-mfa-screen.md)

## 実装内容

`src/proxy.ts` の既存の `is_admin` 判定（Task 1）に、`aal` と 60 分の判定を足す。

- `getClaims()` の結果から `aal` を読む。**`aal` は Supabase の JWT の必須項目**なので、手元の署名検証だけで分かり、Supabase Auth への通信は増えない（要件 7.1 の方針を守る）。
- factor を持っているかどうかは JWT に入っていないため、`aal1` のときだけ `listFactors` 相当の確認を行う。`aal2` のときは確認しない（毎回の通信を増やさない）。
- Task 4 の `adminGateDecision` に渡し、返り値で振り分ける。

| 判定 | `/admin` 配下（画面） | `/api/admin` 配下（API） |
|---|---|---|
| `not_found` | 404 | 404 |
| `enroll` / `verify` | `/admin/mfa?redirect_to=…` へ | **401 と `error: "admin_mfa_required"`** |
| `allow` | 通す | 通す |

- API を 302 で画面へ送らないこと。`fetchWithAuthRedirect`（[fetch-with-auth-redirect.ts](../../../../src/lib/api/fetch-with-auth-redirect.ts)）に `admin_mfa_required` の行き先（`/admin/mfa`）を足し、401 の本文を見て振り分ける（#583 と同じ作り）。
- **`/admin/mfa` 自身は `enroll`・`verify` でも通す**（そうしないと無限に転送される）。ただし `not_found` は 404 のままにして、管理者でない人に画面の存在を知らせない。
- 既存の並び（30 日の放置 → `getClaims` → 最終利用日 → プロフィール取得 → 登録途中 → 再同意 → 停止 → `/admin` の `is_admin`）は崩さず、`is_admin` 判定の直後に足す。

## 成果物

- `src/proxy.ts`（`/admin` 配下の判定に `aal` と 60 分を追加）
- `src/lib/api/fetch-with-auth-redirect.ts`（`admin_mfa_required` の行き先を追加）
- 各ファイルのテスト

## テスト要件

### 単体テスト
- `loginRedirectFor` が `admin_mfa_required` に対して `/admin/mfa?redirect_to=…` を返すこと。既存の `reconsent_required`・`signup_required`・既定の `/login` が変わっていないこと
- `/admin/mfa` へのリクエストは `enroll`・`verify` でも通り、`not_found` では 404 になること
- `/api/admin` 配下は `enroll`・`verify` で 401 と `admin_mfa_required` を返し、302 を返さないこと
- `aal2` のときに factor の確認（追加の通信）を行わないこと

### 結合テスト
- `is_admin=true` かつ `aal1` のセッションで `/admin` を開くと `/admin/mfa` に送られ、`aal2` かつ 30 分前に確認済みなら SC-16 が出ること
- 同じセッションで `/admin/reports` のような深い URL を開いたとき、`redirect_to` にその URL が入り、確認後にそこへ戻ること

### E2Eテスト
- なし（[Task 9](09-acceptance-e2e-mfa.md) でまとめて検証する）

## 関連する受入条件

- SC-32 を含む `/admin` 配下・`/api/admin` 配下のすべてで、`is_admin` が false と未ログインは 404 になること
- 二段階確認から 60 分を過ぎると管理画面で聞き直され、通ると元の行き先に進めること。このとき利用者としてはログアウトされておらず、一般の画面はそのまま使えること
