# Task 1: 通信の回数を減らす

> 出典: [performance.md](../../../user-stories/shared-ui/performance.md)
> インデックス: [performance](00-index.md)

## 依存

- なし（既存の関所・共通関数の置き換え）

## 実装内容

1. **認証確認を `getClaims()` に**。`src/proxy.ts`、`src/app/layout.tsx`、`src/lib/auth/get-authenticated-user.ts`（全 API 共通）、`src/lib/auth/require-user-or-redirect.ts`（全ページ共通）。返す値は `{ id, email }`（`AuthUser`）に絞り、Google の識別子・表示名が要る新規登録 API（`ensureUserRecord`）だけ `getUser()` を残す。前提: Supabase の署名鍵が非対称（ES256。確認済み）
2. **先読み（prefetch）では関所の users 問い合わせを省く**。`Next-Router-Prefetch` ヘッダで判定。認証確認は行う（未ログインの先読みで中身を返さない）
3. **一覧のカードは先読みしない**。`SpotCard`・`PostCard`・通知一覧・行きたい・しおり一覧・アルバムの投稿・マイページの投稿済み・しおりのスポット行に `prefetch={false}`。メニューバーの 4 つは残す
4. **直列クエリを並列に**。`load-search-page.ts`（行き先の解決 ∥ 追加モード、1 ページ目 ∥ スポットの見出し）、投稿詳細（本体 ∥ コメント 1 ページ目）
5. **未読件数は 60 秒に 1 回**。`AppMenuBar` で前回取得から 60 秒以内なら再取得しない（通知一覧で既読にしたときは即時）
6. **直前に見た画面は 30 秒間サーバーへ行かない**。`next.config.ts` の `experimental.staleTimes = { dynamic: 30 }`

## 成果物

- `src/lib/auth/auth-user.ts`（`AuthUser` 型と claims → AuthUser の変換。純粋関数）
- 上記 1〜6 の変更

## テスト要件

### 単体テスト
- claims → AuthUser の変換（sub が無ければ null、email の有無）
- `getAuthenticatedUser`・`requireUserOrRedirect` が claims から id を返し、無効なら null／ログインへリダイレクト
- proxy: 先読みリクエストでは users を引かず、認証だけ行う。通常のリクエストでは従来どおり（登録待ち・一時停止・30 日失効）
- `AppMenuBar`: 60 秒以内の再遷移で未読件数を取り直さない。既読イベントでは取り直す

### 結合テスト
- 本番ビルドでスポット別一覧を開き、サーバー応答・先読み本数・往復回数が受入条件を満たすこと（手動計測）

## 関連する受入条件

- performance.md の受入条件 1〜3
