# Task 1: 滞在時間の 7 択と「宿泊施設」の自動入力

> 出典: [feedback-0919.md](../../../user-stories/shared-ui/feedback-0919.md)
> インデックス: [feedback-0919](00-index.md)
> 要件: [requirement.md](../../../requirement.md) v3.2 の改訂表

## 依存

- なし

## 実装内容

- `POST_DURATIONS` を 7 値（30分以内／1時間以内／2時間以内／3時間以内／半日／1日／宿泊）にし、旧値「それ以上」は `LEGACY_POST_DURATIONS` として表示・絞り込みでだけ受け付ける（新規・編集の入力では出さない）
- マイグレーション：`posts.duration` の CHECK 制約を 7 値＋「それ以上」の 8 値に更新（既存行は書き換えない）
- `PostFormFields`：滞在時間のドロップダウンを 7 択に。カテゴリが「宿泊施設」に変わったとき滞在時間が未選択なら「宿泊」を入れる（既に値があれば触らない。カテゴリを別の値に戻しても滞在時間は戻さない）
- `FilterSheet`：滞在時間を 7 択＋指定なしに。`applyFilters`（search-posts.ts）で「半日」「1日」「宿泊」のいずれかが選ばれたら「それ以上」も含める
- 投稿詳細・投稿カード・写真モーダルの表示は文字列をそのまま出す（「それ以上」も表示できる）

## 成果物

- `src/lib/posts/constants.ts`
- `supabase/migrations/2026MMDD000001_post_duration_7.sql`
- `src/components/posts/PostFormFields.tsx`・`FilterSheet.tsx`
- `src/lib/posts/search-posts.ts`・`src/components/posts/post-search-query.ts`

## テスト要件

### 単体テスト
- カテゴリを「宿泊施設」にすると未選択の滞在時間が「宿泊」になり、選択済みなら変わらないこと
- 入力の選択肢に「それ以上」が無く、「それ以上」の既存値を持つ投稿の編集画面で値が保たれること（送信時は選び直しを促す）
- 絞り込み「半日」で「それ以上」の投稿が含まれること

### 結合テスト
- `POST /api/posts` が「それ以上」を拒否し、「宿泊」を受け付けること

### E2Eテスト
- なし（[Task 8: 受入テスト（E2E）](08-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 受入条件71
