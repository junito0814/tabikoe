# Task 3: 最終利用日を 1 日 1 回だけ記録し、「使った人」を出す

> 出典: [admin-shell-dashboard.md](../../../user-stories/admin/admin-shell-dashboard.md)
> インデックス: [admin-shell-dashboard](00-index.md)
> 要件定義書 3.10.3、7.4

## 実装内容

- マイグレーション：`users.last_active_at timestamptz` を追加。本人は更新できない列（列単位の GRANT。5.3 の方針）
- `src/proxy.ts`：ログイン済みの利用者のリクエストで、**その日まだ更新していなければ** `last_active_at = now()` にする
  - 「今日更新したか」は Cookie（`tabikoe-last-active-day = YYYY-MM-DD`）で判定し、Cookie が今日なら DB に触らない。**1 人 1 日 1 回の書き込み**に収める
  - 【初心者向け】毎リクエストで UPDATE すると、performance Task1・2 で減らした往復がまた増える。Cookie を「今日はもう書いた」の印に使う
  - 判定は純粋関数 `shouldTouchLastActiveDay(cookieValue, now)` に切り出す（session-activity.ts の `shouldTouchLastActive` と同じ作り）
- `loadAdminDashboard`：今日・今週に `last_active_at` がある利用者の数を「使った人」として返す
- 個人情報保護方針（legal-documents で本文を作る）に「最終利用日を記録する」旨を入れる（このタスクでは要件 7.4 の記述のとおり）

## テスト要件

### 単体テスト
- `shouldTouchLastActiveDay`：Cookie が無い／昨日なら true、今日なら false
- proxy：同じ日の 2 回目のリクエストでは更新の問い合わせが走らないこと
- ダッシュボード：今日・今週の集計

## 関連する受入条件

- admin-shell-dashboard.md の受入条件 3・6
