# ストライク制と自動対応（strike-system）タスク

> カテゴリ: `safety` / ストーリー: `strike-system`
> 出典: [strike-system.md](../../../user-stories/safety/strike-system.md)

Task 1（判断のルールとデータ）を最初に入れ、以降はそれを使う。

| # | タスク | 依存 |
|---|---|---|
| 1 | [ストライクのデータと判断のルール（純粋関数）](01-strike-rules-and-data.md) | なし |
| 2 | [通報対応でストライクを付け、本人に通知し、投稿・コメントを止める](02-strike-on-resolve.md) | 1 |
| 3 | [異なる通報者 3 人で投稿を自動的に非公開にする](03-auto-hide.md) | 1, admin-shell-dashboard 4 |
| 4 | [有効なストライク 5 と重大な違反で仮停止し、管理者が確定・解除する](04-provisional-suspension.md) | 2, user-management 2 |
| 5 | ~~[マイページ「アカウントの状態」（SC-28）](05-account-status.md)~~ → **2026-10-04 に廃止** | 2 |
| 6 | [スポット情報の誤りは登録者に修正を依頼する（SC-29）](06-spot-fix-request.md) | 2 |
