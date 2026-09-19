# Task 2: スポット登録バッジ（spots.created_by）

> 出典: [feedback-0919.md](../../../user-stories/shared-ui/feedback-0919.md)
> インデックス: [feedback-0919](00-index.md)
> 要件: [requirement.md](../../../requirement.md) v3.2 の改訂表

## 依存

- なし

## 実装内容

- マイグレーション：`spots.created_by uuid references users(id) on delete set null` を追加し、既存の source = manual の行を「最も古い公開投稿の投稿者」で一括更新する
- スポット作成（投稿の公開処理の中で新しいスポットを作る Route Handlers）で、source = manual のときだけ `created_by` に投稿者を入れる
- `lib/badges/catalog.ts` に種別 `spot_registration`（段階 1／3／5／10／20／30／50）を追加。`award-badges.ts` で `created_by = 自分` の行数を数えて判定する（下書きでは判定しない）
- `badge-status.ts`・ステータスバッジ画面（SC-10）に「スポット登録バッジ」の段を追加。獲得時のトーストは既存の仕組み

## 成果物

- `supabase/migrations/2026MMDD000002_spots_created_by.sql`
- `src/lib/spots/*`（スポット作成）・`src/app/api/posts/route.ts`
- `src/lib/badges/catalog.ts`・`award-badges.ts`・`badge-status.ts`
- `src/components/badges/*`（SC-10）

## テスト要件

### 単体テスト
- manual スポットを 3 件登録した利用者に 1 件・3 件のバッジが付き、5 件は付かないこと
- places スポットへの初投稿では数えないこと
- 既存行の一括更新が最も古い公開投稿の投稿者を選ぶこと（SQL のテストまたはシードでの確認）

### 結合テスト
- 投稿の公開で新しい manual スポットができたとき、応答にバッジ獲得が含まれること

### E2Eテスト
- なし（[Task 8: 受入テスト（E2E）](08-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 受入条件72
