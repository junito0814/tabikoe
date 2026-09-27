# Task 2: 通報対応でストライクを付け、本人に通知し、投稿・コメントを止める

> 出典: [strike-system.md](../../../user-stories/safety/strike-system.md)
> インデックス: [strike-system](00-index.md)
> 要件定義書 3.10.6・3.10.7・3.9.1

## 実装内容

- `POST /api/admin/reports/[id]/action`：`hide` / `delete` で確定したとき
  1. 対応理由（`note`）を**必須**にする（空なら 400）
  2. 投稿者に `strikes` を 1 行追加
  3. `measureForStrikeCount` の結果で `posting_restricted_until` を更新（`restrict`）／Task 4 の仮停止を呼ぶ（`suspend` または重大な違反）
  4. 本人に通知（種類 `moderation_action`：理由・対象・措置・解除日）。通報者は含めない
  5. 操作の記録に「非公開化／削除」「ストライク付与」を残す（user-management Task 4 の `admin_actions`）
- 通報詳細画面（`ReportDetailScreen`）：確定ボタンの近くに「本人に 1 ストライク（有効 N → N+1：〈次の措置〉）」の予告を出す。理由が空なら押せない
- 投稿・コメントの作成 API：`posting_restricted_until` が未来なら 403 `posting_restricted` と解除日を返す。投稿画面はその場合、理由と解除日を表示して投稿ボタンを無効にする
- 【初心者向け】「投稿禁止」は投稿とコメントの**作成**だけを止める。閲覧・保存・しおりは通る。判定は API 側で行う（画面だけ止めても直接叩けるため）

## テスト要件

### 単体テスト
- 理由が空だと確定できないこと
- `hide` 確定でストライクが 1 行増え、本人に通知が作られ、通報者が通知に含まれないこと
- 有効 2 で `posting_restricted_until` が 3 日後になること
- 制限中に投稿・コメント API が 403 と解除日を返すこと

## 関連する受入条件

- strike-system.md の受入条件 2・3
