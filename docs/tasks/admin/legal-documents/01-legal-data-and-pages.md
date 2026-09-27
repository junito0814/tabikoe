# Task 1: 規約のデータと公開ページ（/terms・/privacy）、登録時の版の記録

> 出典: [legal-documents.md](../../../user-stories/admin/legal-documents.md)
> インデックス: [legal-documents](00-index.md)
> 要件定義書 3.10.11、7.4

## 実装内容

- マイグレーション
  - `legal_documents`（id, kind, version, summary, body, status, published_at, published_by, created_at）。`kind + version` で一意。読み取りは誰でも（`status = published` のみ RLS で公開）、書き込みは service_role
  - `user_consents`（user_id, kind, version, agreed_at）。本人が自分の分を読める
  - 初期データ：利用規約 1.0・個人情報保護方針 1.0 を `published` で投入する（本文は要件 7.4・3.8・3.10 の内容を反映した素案。**本文の最終確認はユーザー**。マイグレーションの冒頭に「素案」と明記）
- `GET /api/legal/[kind]?version=`：公開中の最新版（または指定の版）
- `src/app/terms/page.tsx`・`src/app/privacy/page.tsx`：Markdown を描画。版と公開日、過去の版へのリンク。未ログインでも読める（proxy の許可リストに足す）
- 同意画面（SC-20）のチェック欄の文言を `/terms`・`/privacy` へのリンクにする。`POST /api/auth/signup` で `user_consents` に両方の**公開中の版**を記録する
- 【初心者向け】「同意した」という事実は、**何に**同意したかが分からなければ意味が無い。だから版を持ち、同意の記録に版を残す

## テスト要件

### 単体テスト
- API：公開中の最新版が返り、下書きは返らないこと
- signup：`user_consents` に terms・privacy の 2 行が版付きで作られること
- proxy：`/terms` `/privacy` が未ログインで通ること

## 関連する受入条件

- legal-documents.md の受入条件 1・5
