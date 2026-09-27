# 利用者の管理・非公開の復元・操作の記録（user-management）タスク

> カテゴリ: `admin` / ストーリー: `user-management`
> 出典: [user-management.md](../../../user-stories/admin/user-management.md)

Task 4（操作の記録）は他のタスクが書き込む先なので、実装の順は 4 → 1 → 2 → 3 でもよい。

| # | タスク | 依存 |
|---|---|---|
| 1 | [利用者一覧と検索（SC-24）](01-user-list.md) | admin-shell-dashboard 1 |
| 2 | [利用者詳細：停止と解除・投稿の一括非公開・ストライクの取り消し](02-user-detail-actions.md) | 1, strike-system 1 |
| 3 | [非公開にしたものの一覧と復元（SC-25）](03-hidden-items.md) | admin-shell-dashboard 1, strike-system 3 |
| 4 | [操作の記録（admin_actions）と画面（SC-27）](04-admin-actions-log.md) | admin-shell-dashboard 1 |
