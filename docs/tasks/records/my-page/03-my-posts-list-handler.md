# Task 3: 自分の投稿一覧の取得・旅行単位の絞り込み

> 出典: [my-page.md](../../../user-stories/records/my-page.md)
> インデックス: [my-page](00-index.md)

## 依存

- post-creation [Task1: 投稿関連テーブルのスキーマ定義・マイグレーション](../../posts/post-creation/01-post-schema-migration.md)
- trip-title [Task5: 表示範囲の制御（マイページ・アルバム画面のみ表示）](../../posts/trip-title/05-display-scope-control.md)

## 実装内容

- `GET /api/users/me/posts`を実装し、ログインユーザー自身の投稿を新着順で返す（非公開投稿を含む）
- クエリパラメータで`trip_id`を受け取り、指定された旅行の投稿のみに絞り込めるようにする
- 各投稿に旅行タイトル（`trips.title`）を含めて返す。旅行タイトルをマイページに表示すること自体はtrip-titleの表示範囲制御で許可済みの画面である

## 成果物

- `app/api/users/me/posts/route.ts`

## テスト要件

### 単体テスト
- `trip_id`指定時に、当該旅行の投稿のみが返ることを検証する

### 結合テスト
- テスト用DBで、複数旅行にまたがる投稿を持つユーザーに対し、絞り込みなしでは新着順の全件、絞り込みありでは該当旅行のみが返ることを確認する
- 非公開投稿が結果に含まれることを確認する

### E2Eテスト
- なし（[Task 5: 受入テスト（E2E）](05-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 自分の投稿一覧が新着順に表示され、旅行単位で絞り込みができること
