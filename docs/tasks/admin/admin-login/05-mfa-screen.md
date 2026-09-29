# Task 5: 管理者の二段階確認画面（SC-32）と Supabase MFA の登録・確認

> 出典: [admin-login.md](../../../user-stories/admin/admin-login.md)
> インデックス: [admin-login](00-index.md)

## 依存

- [Task 4: 二段階確認の判定を純粋関数に切り出す](04-mfa-decision-rules.md)

## 実装内容

SC-32 を作る。1 つの画面で「登録」と「確認」の 2 つの状態を持つ（[wireframes.md](../../../wireframes.md) の SC-32）。

### 登録（factor が無い管理者）

- `supabase.auth.mfa.enroll({ factorType: "totp" })` を呼び、返ってきた QR コード（`totp.qr_code`）と手入力用の文字列（`totp.secret`）を出す。
- 認証アプリで読み取ってもらい、6 桁を入力 → `challenge()` → `verify()` で確定する。
- **確定した時点で `aal2` に上がる**ので、そのまま元の行き先（既定は SC-16）へ進める。

### 確認（factor はあるが `aal1`）

- `listFactors()` で verified な TOTP factor を取り、`challenge()` → `verify()` で `aal2` に上げる。
- QR コードは出さない（登録済みの人に secret を再表示しない）。

### 共通

- メニューバーは出さない（利用者向け・管理用のどちらも。要件 4.2）。「サイトへ戻る」だけを置く。
- 6 桁が違うときは画面にとどまり、何が起きたかを日本語で出す。**入力欄を消さず、やり直せるようにする**。
- 元の行き先は `redirect_to` で受け取り、`/admin` 配下に限って受け入れる（外部 URL への転送に使われないようにする）。
- `verify()` が成功した時刻を **Cookie（HttpOnly・Secure・SameSite=Lax）** に入れる。Task 6 の 60 分判定と Task 7 の 10 分判定がこれを読む。DB には持たない（テーブルを増やさない方針）。

### 未確認の点（実装時に確かめる）

Supabase Auth のアプリ側 MFA で、**factor を verify したときに同じ利用者の他のセッションがどうなるか**は公式ドキュメントに明記が無い（ダッシュボードのアカウントの MFA では「他のセッションをすべてログアウトする」と書かれているが、これはアプリ側の話ではない）。実機で確認し、他端末がログアウトされるならその旨を SC-32 の画面に出す。

## 成果物

- `src/app/admin/mfa/page.tsx`（SC-32）
- `src/components/admin/AdminMfaScreen.tsx`
- `src/lib/admin/mfa-verified-cookie.ts`（確認時刻の Cookie の読み書き）
- 各ファイルのテスト

## テスト要件

### 単体テスト
- `redirect_to` が `/admin` 配下のときはそのまま使い、外部 URL・`/` 始まりでない値・`/admin` 以外は既定（SC-16）に落とすこと
- 確認時刻の Cookie を書いて読み戻せること。壊れた値・空のときは「未確認」として扱うこと
- factor が無い状態では QR コードを出し、ある状態では出さないこと（画面のテスト）
- 6 桁が違うときに入力欄が残り、エラー文が出ること

### 結合テスト
- `is_admin=true` で factor の無いユーザーが `/admin/mfa` を開くと登録の状態になり、`is_admin=false` と未ログインでは 404 になること

### E2Eテスト
- なし（[Task 9](09-acceptance-e2e-mfa.md) でまとめて検証する）

## 関連する受入条件

- `is_admin` が true でも認証アプリを登録していない管理者は管理画面に入れず、SC-32 で QR コードから登録して 6 桁を入れると SC-16 に着地すること
