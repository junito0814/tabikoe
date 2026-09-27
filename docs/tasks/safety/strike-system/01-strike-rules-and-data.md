# Task 1: ストライクのデータと判断のルール（純粋関数）

> 出典: [strike-system.md](../../../user-stories/safety/strike-system.md)
> インデックス: [strike-system](00-index.md)
> 要件定義書 3.10.7・3.10.8

## 実装内容

- マイグレーション
  - `strikes`（id, user_id, report_id, reason, created_at, expires_at＝created_at + 90 日, revoked_at, revoked_by, revoke_note）
  - `users` に `posting_restricted_until timestamptz`（投稿・コメント禁止の解除日）、`suspension_kind text`（`provisional` / `confirmed`。既存の `suspended_at` と併用）
  - `moderation_settings`（キー・値。`auto_hide_reporters = 3`、`strike_expiry_days = 90`、`strikes_to_suspend = 5`、`restriction_days = [0,3,7,30]`、`unreliable_reporter_no_issue = 3`）。コードに直書きしない
- `src/lib/moderation/strike-rules.ts`（新規、純粋関数）
  - `activeStrikes(strikes, now)`：失効・取り消しを除いた有効な数
  - `measureForStrikeCount(n, settings)`：`{ kind: "warn" | "restrict" | "suspend", days }`
  - `isSevereReason(reason)`：個人情報の掲載・なりすまし
  - `shouldAutoHide(reports, noIssueCountByReporter, settings)`：異なる通報者の数（信頼度の低い通報者を除く）が 3 以上か
  - 【初心者向け】ルールを関数に閉じ込めておくと、しきい値を変えたときも画面や API を触らずここのテストだけで確かめられる

## テスト要件

### 単体テスト
- 91 日前・取り消し済みのストライクが数に入らないこと
- 1→警告、2→3 日、3→7 日、4→30 日、5→停止 になること
- 個人情報・なりすましが重大と判定されること
- 同じ通報者の重複は 1 人、「問題なし」3 件以上の通報者は数えないこと

## 関連する受入条件

- strike-system.md の受入条件 1・5・8
