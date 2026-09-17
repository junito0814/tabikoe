# Task 2: メンバー管理・退出と通知

> 出典: [itinerary-sharing.md](../../../user-stories/itinerary/itinerary-sharing.md)
> インデックス: [itinerary-sharing](00-index.md)

## 依存

- Task 1

## 実装内容

- `GET /api/itineraries/[id]/members`、`DELETE .../members/[userId]`（オーナーのみ）、`DELETE .../members/me`（退出）
- 通知種別カタログに `itinerary_joined`（本人・オーナー・既存メンバー）・`itinerary_member_removed`（本人）を追加し、受諾・削除時に `create-notification.ts` で作成する
- 「⋯」→「招待」（リンク発行・コピー・無効化）「メンバー」（一覧・削除・退出）の UI

## 成果物

- `src/app/api/itineraries/[id]/members/**/route.ts`
- `src/lib/notifications/catalog.ts`
- `src/components/itineraries/InviteDialog.tsx`
- `src/components/itineraries/MembersDialog.tsx`

## テスト要件

### 単体テスト
- 通知種別の定義と通知先
- メンバーとオーナーでダイアログの操作が変わること

### 結合テスト
- 受諾時に通知が本人・オーナー・既存メンバーに作られること

### E2Eテスト
- なし（[Task 4: 受入テスト（E2E）](04-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- メンバーが退出でき、しおりへの参加・削除が通知されること
