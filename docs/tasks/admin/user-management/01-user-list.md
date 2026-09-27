# Task 1: 利用者一覧と検索（SC-24）

> 出典: [user-management.md](../../../user-stories/admin/user-management.md)
> インデックス: [user-management](00-index.md)
> 要件定義書 3.10.9

## 実装内容

- `GET /api/admin/users?q=&status=&sort=&offset=`：表示名・メールの部分一致。状態（通常／投稿禁止中／仮停止／停止）で絞る。並びは最終利用が新しい順・登録が新しい順・通報された回数順。20 件ずつ
  - 返す列：id・表示名・メール・登録日・最終利用・投稿数・通報された回数・有効なストライク数・状態
  - 【初心者向け】メールは管理者だけが見る情報。この API は `is_admin` の確認（既存の管理用 API と同じ）を必ず通す
- `src/app/admin/users/page.tsx` と `UserListScreen`：wireframes SC-24 の一覧のとおり。ストライクは丸 5 つ
- 集計の判断（状態の決め方＝`suspended_at` / `posting_restricted_until` / `suspension_kind` から 1 語にする）は純粋関数 `userStatusOf(user, now)` に切り出す

## テスト要件

### 単体テスト
- `userStatusOf`：通常／投稿禁止中（期限内）／仮停止／停止 の判定
- API：検索・絞り込み・並びが効き、一般利用者では 404 になること
- 画面：列と状態チップ、ストライクの丸

## 関連する受入条件

- user-management.md の受入条件 1
