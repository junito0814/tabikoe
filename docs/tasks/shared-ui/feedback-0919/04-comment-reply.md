# Task 4: コメントへの返信（parent_id・表示・通知・削除の枠）

> 出典: [feedback-0919.md](../../../user-stories/shared-ui/feedback-0919.md)
> インデックス: [feedback-0919](00-index.md)
> 要件: [requirement.md](../../../requirement.md) v3.2 の改訂表

## 依存

- なし

## 実装内容

- マイグレーション：`comments.parent_id uuid references comments(id)`（NULL＝最上位）、`comments.deleted_at timestamptz`（返信を持つ親の論理削除用）を追加。parent_id の親が同じ post_id であることをトリガーまたは CHECK 関数で保証。notifications.type に `comment_replied` を追加
- `POST /api/posts/[id]/comments` に `parentId`（任意）を追加。返信への返信は parent_id に直接の返信先を入れる。返信先のコメント投稿者に `comment_replied` 通知（自分自身は除く。投稿者本人なら既存の `comment` 通知だけにして二重に送らない）
- `GET`（list-comments.ts）：parent_id が NULL の 20 件＋その返信（時系列）をまとめて返す。deleted_at のある親は body・投稿者を伏せて `deleted: true` で返す。件数（投稿カード・投稿詳細）は返信を含める
- `DELETE /api/comments/[id]`：返信が 1 件以上ある親は deleted_at を入れる論理削除、無ければ物理削除。返信が全部消えて枠だけ残った親は物理削除する
- `CommentSection`：各コメントに「返信」。押すと入力欄に「@名前」チップが入り返信モード（× で解除）。返信は親の下に 1 段だけ字下げして時系列に平らに並べ、先頭に「@名前 への返信」。3 件を超えたら「返信をさらに N 件見る」で開く。「削除されたコメント」の枠を描く
- 通知一覧（SC-14）：`comment_replied` の文言「〈名前〉さんがあなたのコメントに返信しました」→ 投稿詳細へ
- 通報・ブロック・レート制限・4,000 文字は既存のコメントと同じ

## 成果物

- `supabase/migrations/2026MMDD000003_comment_replies.sql`
- `src/app/api/posts/[id]/comments/route.ts`・`src/app/api/comments/[id]/route.ts`
- `src/lib/comments/list-comments.ts`・`validate-comment.ts`
- `src/components/comments/CommentSection.tsx`
- `src/lib/notifications/*`・`src/components/notifications/*`

## テスト要件

### 単体テスト
- 返信が親の下に 1 段字下げで並び、深さ 2 の返信も同じ字下げであること。「@名前 への返信」が出ること
- 返信 4 件のとき 3 件＋「返信をさらに 1 件見る」になること
- 親を削除すると「削除されたコメント」の枠が出て返信が残ること。返信の無い親の削除は枠を残さないこと
- 返信の通知先が返信先の投稿者で、自分への返信では送られないこと

### 結合テスト
- 別の post_id のコメントを parent_id に指定すると 400 になること

### E2Eテスト
- なし（[Task 8: 受入テスト（E2E）](08-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 受入条件77
