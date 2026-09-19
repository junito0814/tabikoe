# Task 6: しおり・アルバムのアプリ内招待（候補・検索・通知）

> 出典: [feedback-0919.md](../../../user-stories/shared-ui/feedback-0919.md)
> インデックス: [feedback-0919](00-index.md)
> 要件: [requirement.md](../../../requirement.md) v3.2 の改訂表

## 依存

- なし

## 実装内容

- マイグレーション：`album_invitations`・`itinerary_invitations` に `invitee_user_id uuid references users(id)`（NULL＝リンク招待）・`status text`（pending／accepted／declined／revoked。既定 pending）・`responded_at` を追加。未回答の同じ相手への招待を 1 件に限る部分ユニーク索引。notifications.type に `album_invited`・`itinerary_invited` を追加。rate_limits の action に `user_search`（1 分 30 回）を追加し、招待の送信は既存の `album_invite`／`itinerary_invite`（1 時間 10 件）で数える
- `GET /api/users/search?q=`：ユーザー名の部分一致（2 文字以上、最大 20 件、退会・ブロック関係・自分を除く）
- `GET /api/albums/[tripId]/invite-candidates`・`GET /api/itineraries/[id]/invite-candidates`：自分と同じ trip_id／itinerary_id のメンバーだった人（album_members ∪ itinerary_members）から、既存メンバー・ブロック関係・未回答の招待がある相手を除いて返す
- `POST /api/albums/[tripId]/invitations`・`POST /api/itineraries/[id]/invitations` に `inviteeUserId`（＋アルバムは role）を追加。作成時に相手へ `album_invited`／`itinerary_invited` 通知
- `POST .../invitations/[id]/accept`・`decline`（本人のみ）、`DELETE .../invitations/[id]`（オーナーの取り消し）。受諾は既存の受諾処理（メンバー追加・参加通知）を再利用
- `InviteDialog`（しおり）と `AlbumScreen` の招待部分：上段に検索欄と「一緒だった人」の候補（[招待を送る]／送信済み）、下段に従来のリンク招待。`MembersDialog` に未回答の招待と「取り消し」
- 通知一覧（SC-14）：招待の通知に「参加する」「辞退」ボタンを置き、その場で応答できる。回答済みの通知は「参加しました」「辞退しました」の表示に変える

## 成果物

- `supabase/migrations/2026MMDD000004_in_app_invitations.sql`
- `src/app/api/users/search/route.ts`・`src/app/api/albums/**`・`src/app/api/itineraries/**`
- `src/lib/albums/invitations.ts`・`src/lib/itineraries/invitations.ts`・`src/lib/users/search-users.ts`（新設）
- `src/components/itineraries/InviteDialog.tsx`・`MembersDialog.tsx`・`src/components/albums/AlbumScreen.tsx`
- `src/components/notifications/*`

## テスト要件

### 単体テスト
- 候補に既存メンバー・ブロック関係・自分が含まれないこと
- 同じ相手への未回答の招待が 2 件目で拒否されること
- 通知の「参加する」で accept が呼ばれ、メンバーに加わること。「辞退」で status が declined になりオーナーに通知が行かないこと

### 結合テスト
- 招待された本人以外が accept を呼ぶと 403 になること
- 取り消し済み・期限切れの招待を accept すると 410 になること

### E2Eテスト
- なし（[Task 8: 受入テスト（E2E）](08-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 受入条件74
