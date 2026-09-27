# Task 3: 異なる通報者 3 人で投稿を自動的に非公開にする

> 出典: [strike-system.md](../../../user-stories/safety/strike-system.md)
> インデックス: [strike-system](00-index.md)
> 要件定義書 3.10.8・3.8.1

## 実装内容

- マイグレーション：`posts`・`comments` に `auto_hidden_at timestamptz`（自動非公開。`hidden_at` とは別に持ち、「問題なし」で戻せるようにする）
- `POST /api/reports`（通報の受付）の最後で、同じ対象の未処理の通報を集め `shouldAutoHide` を判定。真なら `auto_hidden_at = now()` にし、管理者に通知（admin-shell-dashboard Task 4）、操作の記録に「自動で非公開」を残す
- 表示側：`auto_hidden_at` が入っている投稿・コメントは `hidden_at` と同じ扱いで一般利用者に出さない（既存の `hidden_at` の条件に or で足す。本人には「確認中のため非公開」と出す）
- 通報対応：「問題なし」で `auto_hidden_at = null` に戻す。「非公開化」なら `hidden_at` に移す
- 【初心者向け】`hidden_at`（管理者の判断）と `auto_hidden_at`（自動）を分けるのは、「誰の判断で隠れているか」を後から区別するため。復元の画面（user-management Task 3）もこの違いでタブを分ける

## テスト要件

### 単体テスト
- 異なる 3 人で `auto_hidden_at` が入り、同じ人 3 回では入らないこと
- 「問題なし」3 件以上の通報者を除いて 2 人なら入らないこと
- 自動非公開の投稿が一覧・地図・詳細（他人）に出ず、本人には「確認中」と出ること
- 「問題なし」で元に戻ること

## 関連する受入条件

- strike-system.md の受入条件 4・5
