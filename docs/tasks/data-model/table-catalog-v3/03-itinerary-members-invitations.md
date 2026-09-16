# Task 3: itinerary_members・itinerary_invitations テーブルとオーナー継承への組み込み

> 出典: [table-catalog.md](../../../user-stories/data-model/table-catalog.md)
> インデックス: [table-catalog-v3](00-index.md)

## 依存

- Task 2

## 実装内容

- `itinerary_members`（itinerary_id・user_id・role（owner／member）・joined_at、主キー (itinerary_id, user_id)）と `itinerary_invitations`（id・itinerary_id・token UNIQUE・expires_at・revoked_at・created_by）を `album_members`／`album_invitations` と同じ構造で作成する
- RLS：メンバー本人の行と、自分がメンバーであるしおりの行だけ参照できるようにする。招待の受諾（INSERT）は security definer 関数で行い、EXECUTE を service_role に限定する
- 退会処理の DB 関数（`deactivate_user`）に、しおりの owner を旅行のオーナー継承と同じ相手へ移す処理を追加する。メンバーがいなければしおりを削除する

## 成果物

- `supabase/migrations/20260917000003_itinerary_members.sql`
- `deactivate_user` 関数の更新

## テスト要件

### 単体テスト
- なし

### 結合テスト
- しおりのメンバーでないユーザーが authenticated キーで itineraries を取得できないこと
- オーナー退会後に itinerary_members の owner が 1 人だけになること
- security definer 関数が anon／authenticated から実行できないこと

### E2Eテスト
- なし（[Task 6: 受入テスト（E2E）](06-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- アルバムのメンバーであってもしおりに招待されていなければしおりが見えないこと（受入条件64）
- 退会処理・レート制限判定のDB関数が、フロントエンドに配布される公開鍵からは実行できないこと（受入条件40）
