# Task 4: 管理者への通知（新しい通報・自動非公開・仮停止）

> 出典: [admin-shell-dashboard.md](../../../user-stories/admin/admin-shell-dashboard.md)
> インデックス: [admin-shell-dashboard](00-index.md)
> 要件定義書 3.9.1「管理者への通知」

## 実装内容

- 通知の種類に `admin_report`（新しい通報）・`admin_auto_hidden`（自動非公開）・`admin_suspended`（仮停止）を追加（既存の `notifications` の仕組みを使う。メールは使わない）
- 送り先は `is_admin = true` の利用者全員。`src/lib/notifications/notify-admins.ts`（新規）に「管理者全員に同じ通知を作る」関数を置く
- `POST /api/reports`（通報の受付）の最後で `notifyAdmins("admin_report", …)` を呼ぶ。自動非公開・仮停止は strike-system Task3・4 から呼ぶ
- 通知のタップで `/admin/reports/<id>`・`/admin/hidden`・`/admin/users/<id>` へ
- 通知一覧（SC-14）で管理者向けの種類も表示できるようにする（文言：「新しい通報：〈対象〉」「投稿が自動で非公開になりました」「〈名前〉さんを仮停止しました」）

## テスト要件

### 単体テスト
- `notifyAdmins`：管理者が 2 人なら 2 件作られ、一般利用者には作られないこと
- 通報の受付で管理者向け通知が作られること（既存の `POST /api/reports` のテストに追加）

## 関連する受入条件

- admin-shell-dashboard.md の受入条件 5
