# Task 2: 利用者詳細：停止と解除・投稿の一括非公開・ストライクの取り消し

> 出典: [user-management.md](../../../user-stories/admin/user-management.md)
> インデックス: [user-management](00-index.md)
> 要件定義書 3.10.9・3.10.7「取り消し」

## 実装内容

- `GET /api/admin/users/[id]`：プロフィール、ストライクの履歴（有効／失効／取り消し）、投稿・コメント・通報された履歴・この人への操作（Task 4）、今の制限
- `POST /api/admin/users/[id]/suspend`（理由必須、`hidePosts: boolean` 既定 true）：`suspended_at`・`suspension_kind = confirmed`。`hidePosts` なら本人の公開投稿を `hidden_at` にして `hidden_reason = suspension` を付ける（解除で戻せるように印を残す）。本人に通知。操作の記録
- `POST /api/admin/users/[id]/unsuspend`（理由必須、`restorePosts: boolean`）：`suspended_at = null`。停止で隠した投稿を戻す。操作の記録
- `POST /api/admin/users/[id]/confirm-suspension`：仮停止の確定（strike-system Task 4）
- `POST /api/admin/strikes/[id]/revoke`（理由必須）：`revoked_at` を入れ、制限を再計算（有効数が減れば `posting_restricted_until` を見直す）。操作の記録
- `src/app/admin/users/[id]/page.tsx` と `UserDetailScreen`：wireframes SC-24 詳細のとおり。停止・解除・取り消しは確認ダイアログ
- 管理者を停止する守りは**付けない**（決定）

## テスト要件

### 単体テスト
- 理由が空だと停止・解除・取り消しができないこと
- 停止で `hidePosts` 既定 true のとき公開投稿が全部隠れ、解除で戻ること
- 取り消しで有効なストライク数が減り、制限が再計算されること
- 各操作が本人通知（停止・解除）と操作の記録を作ること

## 関連する受入条件

- user-management.md の受入条件 2・3・6
