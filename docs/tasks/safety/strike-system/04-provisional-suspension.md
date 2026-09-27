# Task 4: 有効なストライク 5 と重大な違反で仮停止し、管理者が確定・解除する

> 出典: [strike-system.md](../../../user-stories/safety/strike-system.md)
> インデックス: [strike-system](00-index.md)
> 要件定義書 3.10.7・3.10.8・3.10.9

## 実装内容

- `src/lib/moderation/suspend.ts`（新規）：`provisionallySuspend(userId, reason)` … `suspended_at = now()`・`suspension_kind = provisional`、本人に通知、管理者に通知、操作の記録
- Task 2 の確定処理から、`measureForStrikeCount` が `suspend`、または `isSevereReason` のとき呼ぶ
- `proxy.ts` の停止判定はそのまま（`suspended_at` があれば弾く）。ログイン画面の文言に「理由は通知に書いてあります」を足す
- 利用者詳細（user-management Task 2）に「仮停止を確定する」「解除する」を出す。確定は `suspension_kind = confirmed`。解除は `suspended_at = null`（理由必須）
- 【初心者向け】仮停止と停止の違いは「誰が判断したか」の記録だけ。利用者から見た挙動は同じ

## テスト要件

### 単体テスト
- 有効 5 で仮停止になり、本人・管理者に通知が作られること
- 個人情報の掲載で確定すると有効 1 でも仮停止になること
- 確定・解除で `suspension_kind` / `suspended_at` が期待どおりになること

## 関連する受入条件

- strike-system.md の受入条件 6・7
