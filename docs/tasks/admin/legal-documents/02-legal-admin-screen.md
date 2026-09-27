# Task 2: 規約管理画面（SC-26）：下書き・公開・版の一覧

> 出典: [legal-documents.md](../../../user-stories/admin/legal-documents.md)
> インデックス: [legal-documents](00-index.md)
> 要件定義書 3.10.11

## 実装内容

- `GET /api/admin/legal?kind=`：版の一覧（状態・公開日・同意済み人数＝`user_consents` でその版に同意した人の数／全利用者）
- `POST /api/admin/legal`（下書きの作成・更新：kind・version・summary・body）、`POST /api/admin/legal/[id]/publish`（公開：`status = published`・`published_at`・`published_by`。同じ kind の前の公開版は `status = archived`）
  - 公開時に 3.9.1「規約の改定」の全員向け通知を 1 件作る（お知らせと同じ仕組み）。操作の記録に「規約を公開」
  - 版は前の公開版より大きい文字列でなければ 400
- `src/app/admin/legal/page.tsx` と `LegalAdminScreen`：wireframes SC-26 のとおり。種類の切替、左で編集、右に版の一覧。「この版を公開する」は確認ダイアログ（「公開すると全員に再同意画面が出ます」）

## テスト要件

### 単体テスト
- 下書きの保存・更新、公開で前の版が archived になること
- 公開で全員向け通知と操作の記録が作られること
- 版の一覧に同意済み人数が出ること

## 関連する受入条件

- legal-documents.md の受入条件 2
