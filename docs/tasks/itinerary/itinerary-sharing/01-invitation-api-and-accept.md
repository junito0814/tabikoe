# Task 1: 招待リンクの発行・無効化・受諾

> 出典: [itinerary-sharing.md](../../../user-stories/itinerary/itinerary-sharing.md)
> インデックス: [itinerary-sharing](00-index.md)

## 依存

- table-catalog-v3 Task 3
- table-catalog-v3 Task 5
- itinerary-basics Task 1

## 実装内容

- `POST /api/itineraries/[id]/invitations`（オーナーのみ。7 日有効、レート制限 `itinerary_invite`）、`DELETE .../invitations/[invitationId]`（無効化）、`POST /api/itinerary-invitations/[token]/accept`（ログイン必須。期限・無効化を検証し member として追加。security definer 関数経由）
- `/itinerary-invitations/[token]` の受諾画面（`InvitationAcceptScreen` を流用）。受諾後は `/itineraries/[id]` へ

## 成果物

- `src/app/api/itineraries/[id]/invitations/route.ts`
- `src/app/api/itinerary-invitations/[token]/accept/route.ts`
- `src/app/itinerary-invitations/[token]/page.tsx`
- `src/lib/itineraries/invitations.ts`

## テスト要件

### 単体テスト
- 期限切れ・無効化済みトークンの拒否
- オーナー以外の発行が 403

### 結合テスト
- 受諾で itinerary_members に member 行が増えること

### E2Eテスト
- なし（[Task 4: 受入テスト（E2E）](04-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 招待リンクが発行から 7 日で無効になり、オーナーが手動で無効化できること
