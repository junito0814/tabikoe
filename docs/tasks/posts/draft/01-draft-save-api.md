# Task 1: 下書きの保存・更新・削除 API

> 出典: [draft.md](../../../user-stories/posts/draft.md)
> インデックス: [draft](00-index.md)

## 依存

- table-catalog-v3 Task 1
- table-catalog-v3 Task 5
- post-creation-v3 Task 1

## 実装内容

- `POST /api/posts`（`status: 'draft'`）と `PATCH /api/posts/[id]` で、必須項目が空でも `lat`／`lng` があれば保存できるようにする。写真は既存のアップロード API で先に上げ、ID を紐づける
- 1 ユーザー 20 件の上限を超えたら 409 で拒否する。レート制限 `draft_save`（1 時間 60 件）を適用する
- `DELETE /api/posts/[id]` で本人の下書きを削除できる（写真も消す）

## 成果物

- `src/app/api/posts/route.ts`
- `src/app/api/posts/[id]/route.ts`
- `src/lib/posts/draft-limits.ts`

## テスト要件

### 単体テスト
- 必須項目が空でも draft なら検証を通ること
- 21 件目の下書きが拒否されること

### 結合テスト
- 下書きが他ユーザーの `GET /api/posts/search`・`/api/spots` に含まれないこと

### E2Eテスト
- なし（[Task 4: 受入テスト（E2E）](04-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 下書きが他のユーザーの地図・一覧・検索・API 応答に一切含まれないこと。21 件目の下書き保存が拒否されること（受入条件52）
