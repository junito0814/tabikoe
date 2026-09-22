# Task 11: Google 1 回で新規登録（認証状態を保持して同意画面へ）

> 出典: [signup-login.md](../../../user-stories/account/signup-login.md)（2026-09-22 変更）
> インデックス: [signup-login](00-index.md)
> 要件定義書 v3.2 3.2.1「画面構成」「同意取得」「未登録ユーザーのログイン」、4.1 SC-20、8 章 42・43、wireframes.md 決定事項 48

## 依存

- [Task 4: OAuth コールバック](04-oauth-callback-handler.md)
- [Task 7: 同意フロー](07-consent-flow.md)（2 つのチェック）

## 実装内容

- ログイン画面（SC-01）のボタンを「Google で続ける」1 つにし、ログインと新規登録を区別しない。`/signup` に直接来た未認証者は SC-01 へ
- コールバック（`/api/auth/callback`）: 未登録なら**セッションを破棄せず**、アカウントも作らずに `/signup`（同意画面）へ。`redirect_to` は引き継ぐ。コールバックではアカウントを作らない（`consent`／`terms`／`privacy` の判定はコールバックから外す）
- 同意画面（SC-20）: Server Component でセッションと `users` 行の有無を見る。未認証 → SC-01 へ、登録済み → ホームへ、「認証済みだが未登録」→ `SignupConsentScreen`（「〈メールアドレス〉として登録します」、2 つのチェック、「同意してはじめる」「やめる」）
- `POST /api/auth/signup`（本体 `{ terms, privacy, redirectTo }`）: 未認証 401、両方の同意が無ければ 400 `consent_required`、登録済みなら作らずに着地点を返す、未登録なら `ensureUserRecord` で作成し `account_create`・`login_success` を記録して `{ href }`（着地点）を返す
- `POST /api/auth/signup/cancel`: 「やめる」。未登録の認証ユーザーなら Supabase Auth 側のユーザーも削除（`auth.admin.deleteUser`）してからサインアウト。登録済みなら何もしない
- Middleware（`src/proxy.ts`）: 認証済みで `users` 行が無い「登録待ち」は `/signup`・`/login`・`/api/auth/*` 以外を開けない（画面は `/signup` へリダイレクト、API は 401 `signup_required`）。既存の一時停止判定と同じ問い合わせで `id` も取り、追加のクエリは増やさない
- 未ログインのホーム（SC-00）: 「アカウントを作成」「ログイン」の 2 ボタンを「はじめる」1 つ（SC-01 へ）に

## 成果物

- `src/components/auth/AuthScreen.tsx`（login のみ。「Google で続ける」）、`src/components/auth/SignupConsentScreen.tsx`、`src/components/auth/ConsentCheckbox.tsx`
- `src/app/signup/page.tsx`、`src/app/api/auth/signup/route.ts`、`src/app/api/auth/signup/cancel/route.ts`
- `src/app/api/auth/callback/route.ts`、`src/proxy.ts`、`src/app/page.tsx` の変更
- `src/lib/auth/pending-signup.ts`（登録待ちで開ける path の判定。純粋関数）

## テスト要件

### 単体テスト
- コールバック: 未登録なら `signOut` せず `/signup` へ（`redirect_to` 付き）、登録済みなら着地点へ
- `POST /api/auth/signup`: 401／片方だけの同意は 400 で作らない／両方で作成して `{ href }`／登録済みは作らず `{ href }`
- Middleware: 登録待ちが `/mypage` を開くと `/signup` へ、`/api/posts` は 401、`/signup`・`/api/auth/*` は通る
- `SignupConsentScreen`: メールアドレスの表示、片方だけでは無効、両方で有効、押すと API が呼ばれ `href` へ遷移、「やめる」で cancel が呼ばれ SC-01 へ
- SC-01: 「Google で続ける」だけがあり、同意欄も「新規登録」の導線も無い

### E2E テスト
- Task 9 でまとめて検証する（Google 1 回で SC-20 → 同意 → ホーム）

## 関連する受入条件

- 要件定義書 8 章 42・43（v3.2）
