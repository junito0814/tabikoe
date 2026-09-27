# Task 3: 非公開にしたものの一覧と復元（SC-25）

> 出典: [user-management.md](../../../user-stories/admin/user-management.md)
> インデックス: [user-management](00-index.md)
> 要件定義書 3.10.10

## 実装内容

- `GET /api/admin/hidden?tab=auto|admin|suspension`：投稿・コメント・スポット・アルバムのうち非公開のものを、非公開になった日時の新しい順に。列は 日時・対象（種類と要約）・理由（自動＝通報者の数と理由の内訳／管理者＝対応理由／停止＝停止の理由）・投稿者
  - 区別は `auto_hidden_at`（自動）、`hidden_at` かつ `hidden_reason = suspension`（停止）、それ以外の `hidden_at`（管理者）
- `POST /api/admin/hidden/[kind]/[id]/restore`（理由必須）：`hidden_at` / `auto_hidden_at` を null に。自動非公開の復元は関連する通報を `no_issue` にする。操作の記録
- `src/app/admin/hidden/page.tsx` と `HiddenItemsScreen`：wireframes SC-25 のとおり。3 タブ、各行に「通報を見る」「復元」
- 削除したもの（行が無い）は出ない。要件 3.10.5 の「復元できる」を、ここで初めて満たす

## テスト要件

### 単体テスト
- 3 タブの区別が `auto_hidden_at` / `hidden_reason` で正しく付くこと
- 復元で公開に戻り、自動非公開なら通報が `no_issue` になること。理由が空なら 400
- 一般利用者では 404

## 関連する受入条件

- user-management.md の受入条件 4
