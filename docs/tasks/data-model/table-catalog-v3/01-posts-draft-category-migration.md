# Task 1: posts の下書き列追加とカテゴリ 7 値への移行

> 出典: [table-catalog.md](../../../user-stories/data-model/table-catalog.md)
> インデックス: [table-catalog-v3](00-index.md)

## 依存

- なし

## 実装内容

- `posts` に `status`（`draft`／`published`、既定 `published`）・`lat`・`lng`・`published_at` を追加する。既存行は `published` とし `published_at` に `created_at` を入れる
- `spot_id`・`category`・`stay_time`・`rating`・`visited_at` の NOT NULL を外し、`status = 'published'` のときだけ必須項目を検証する CHECK 制約に置き換える
- `posts_category_check` を 7 値（グルメ／観光スポット／自然・景勝地／体験・アクティビティ／エンタメ・イベント／ショッピング／宿泊施設）に更新し、既存の「イベント会場」を「エンタメ・イベント」へ一括更新する
- RLS：`status = 'draft'` の行は `user_id = auth.uid()` のときだけ SELECT できるポリシーを追加する。公開投稿の既存ポリシーは `status = 'published'` を条件に加える
- `src/lib/posts/constants.ts` のカテゴリ定数を 7 値に更新する

## 成果物

- `supabase/migrations/20260917000001_posts_draft_and_category.sql`
- `src/lib/posts/constants.ts`（`POST_CATEGORIES`）

## テスト要件

### 単体テスト
- カテゴリ定数が 7 値で、旧値「イベント会場」を含まないことを検証する

### 結合テスト
- draft 行を必須項目 NULL で INSERT でき、published 行では必須項目 NULL が CHECK 違反になること
- 他ユーザーの draft 行が anon／authenticated キーでは取得できないこと
- 移行後に category = 'イベント会場' の行が 0 件であること

### E2Eテスト
- なし（[Task 6: 受入テスト（E2E）](06-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- カテゴリが 7 つから選べ、既存の「イベント会場」の投稿が「エンタメ・イベント」として表示・絞り込みされること（受入条件67）
- 下書きが他のユーザーの地図・一覧・検索・API 応答に一切含まれないこと（受入条件52）
